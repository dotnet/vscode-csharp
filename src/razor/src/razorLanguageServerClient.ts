/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import { EventEmitter } from 'events';
import * as vscode from 'vscode';
import { RequestHandler, RequestType } from 'vscode-jsonrpc';
import { GenericNotificationHandler, InitializeResult, LanguageClientOptions, State } from 'vscode-languageclient';
import { LanguageClient, ServerOptions } from 'vscode-languageclient/node';
import { RazorLanguage } from './razorLanguage';
import { RazorLanguageServerOptions } from './razorLanguageServerOptions';
import { resolveRazorLanguageServerOptions } from './razorLanguageServerOptionsResolver';
import { resolveRazorLanguageServerLogLevel } from './razorLanguageServerTraceResolver';
import { RazorLogger } from './razorLogger';
import { TelemetryReporter as RazorTelemetryReporter } from './telemetryReporter';
import { randomUUID } from 'crypto';

const events = {
    ServerStop: 'ServerStop',
};

export class RazorLanguageServerClient implements vscode.Disposable {
    private clientOptions!: LanguageClientOptions;
    private serverOptions!: ServerOptions;
    private client!: LanguageClient;
    private onStartListeners: Array<() => Promise<any>> = [];
    private onStartedListeners: Array<() => Promise<any>> = [];
    private eventBus: EventEmitter;
    private isStarted: boolean;
    private startHandle: Promise<void> | undefined;
    private stopHandle: Promise<void> | undefined;

    constructor(
        private readonly vscodeType: typeof vscode,
        private readonly languageServerDir: string,
        private readonly razorTelemetryReporter: RazorTelemetryReporter,
        private readonly isCSharpDevKitActivated: boolean,
        
        private readonly env: NodeJS.ProcessEnv,
        private readonly dotnetExecutablePath: string,
        private readonly logger: RazorLogger
    ) {
        this.isStarted = false;

        this.setupLanguageServer();

        this.eventBus = new EventEmitter();
    }

    public get initializeResult(): InitializeResult | undefined {
        return this.client.initializeResult;
    }

    public updateTraceLevel() {
        const languageServerLogLevel = resolveRazorLanguageServerLogLevel(this.vscodeType);
        this.setupLanguageServer();
        this.logger.setTraceLevel(languageServerLogLevel);
    }

    public onStarted(listener: () => Promise<any>) {
        this.onStartedListeners.push(listener);
    }

    public onStart(listener: () => Promise<any>) {
        this.onStartListeners.push(listener);
    }

    public onStop(listener: () => any) {
        this.eventBus.addListener(events.ServerStop, listener);

        const disposable = new vscode.Disposable(() => this.eventBus.removeListener(events.ServerStop, listener));
        return disposable;
    }

    public async start() {
        if (this.startHandle) {
            return this.startHandle;
        }

        let resolve: () => void = Function;
        let reject: (reason: any) => void = Function;
        // tslint:disable-next-line: promise-must-complete
        this.startHandle = new Promise<void>((resolver, rejecter) => {
            resolve = resolver;
            reject = rejecter;
        });

        // Workaround https://github.com/Microsoft/vscode-languageserver-node/issues/472 by tying into state
        // change events to detect when restarts are occuring and then properly reject the Language Server
        // start listeners.
        let restartCount = 0;
        const didChangeStateDisposable = this.client.onDidChangeState(
            (stateChangeEvent: { newState: any; oldState: any }) => {
                if (stateChangeEvent.oldState === State.Starting && stateChangeEvent.newState === State.Stopped) {
                    restartCount++;

                    if (restartCount === 5) {
                        // Timeout, the built-in LanguageClient retries a hardcoded 5 times before giving up. We tie into that
                        // and then given up on starting the language server if we can't start by then.
                        reject(vscode.l10n.t('Server failed to start after retrying 5 times.'));
                    }
                } else if (stateChangeEvent.newState === State.Running) {
                    restartCount = 0;
                }
            }
        );

        try {
            this.logger.logMessage('Starting Razor Language Server...');
            await this.client.start();
            this.logger.logMessage('Server started, waiting for client to be ready...');
            this.isStarted = true;
            for (const listener of this.onStartListeners) {
                await listener();
            }

            // Succesfully started, notify listeners.
            resolve();

            this.logger.logMessage('Server ready!');
            for (const listener of this.onStartedListeners) {
                await listener();
            }

            // We don't want to track restart management after the server has been initially started,
            // the language client will handle that.
            didChangeStateDisposable.dispose();
        } catch (error) {
            vscode.window.showErrorMessage(
                vscode.l10n.t(
                    "Razor Language Server failed to start unexpectedly, please check the 'Razor Log' and report an issue."
                )
            );

            this.razorTelemetryReporter.reportErrorOnServerStart(error as Error);
            reject(error);
        }

        return this.startHandle;
    }

    public async sendRequest<TResponseType>(method: string, param: any) {
        if (!this.isStarted) {
            throw new Error(vscode.l10n.t('Tried to send requests while server is not started.'));
        }

        return this.client.sendRequest<TResponseType>(method, param);
    }

    public async sendNotification(method: string, param: any) {
        if (!this.isStarted) {
            throw new Error(vscode.l10n.t('Tried to send requests while server is not started.'));
        }

        return this.client.sendNotification(method, param);
    }

    public async onRequestWithParams<P, R, E>(method: RequestType<P, R, E>, handler: RequestHandler<P, R, E>) {
        if (!this.isStarted) {
            throw new Error(vscode.l10n.t('Tried to bind on request logic while server is not started.'));
        }

        this.client.onRequest(method, handler);
    }

    public onNotification(method: string, handler: GenericNotificationHandler) {
        if (!this.isStarted) {
            throw new Error(vscode.l10n.t('Tried to bind on notification logic while server is not started.'));
        }

        this.client.onNotification(method, handler);
    }

    public dispose() {
        this.logger.logMessage('Disposing Razor Language Server.');

        this.isStarted = false;
        this.startHandle = undefined;
        this.eventBus.emit(events.ServerStop);
    }

    public async stop() {
        let resolve: () => void = Function;
        let reject: (reason: any) => void = Function;
        // tslint:disable-next-line: promise-must-complete
        this.stopHandle = new Promise<void>((resolver, rejecter) => {
            resolve = resolver;
            reject = rejecter;
        });

        if (!this.startHandle) {
            reject(new Error(vscode.l10n.t('Cannot stop Razor Language Server as it is already stopped.')));
        }

        this.logger.logMessage('Stopping Razor Language Server.');

        try {
            if (this.client) {
                await this.client.stop();
            }

            this.dispose();

            resolve();
        } catch (error) {
            vscode.window.showErrorMessage(
                vscode.l10n.t(
                    "Razor Language Server failed to stop correctly, please check the 'Razor Log' and report an issue."
                )
            );

            reject(error);
        }

        return this.stopHandle;
    }

    public async connectNamedPipe(pipeName: string): Promise<void> {
        await this.startHandle;

        // Params must match https://github.com/dotnet/razor/blob/92005deac54f3e9d1a4d1d8f04389379cccfa354/src/Razor/src/Microsoft.CodeAnalysis.Razor.Workspaces/Protocol/RazorNamedPipeConnectParams.cs#L9
        await this.sendNotification('razor/namedPipeConnect', { pipeName: pipeName });
    }

    private setupLanguageServer() {
        const languageServerTrace = resolveRazorLanguageServerLogLevel(this.vscodeType);
        const options: RazorLanguageServerOptions = resolveRazorLanguageServerOptions(
            this.vscodeType,
            this.languageServerDir,
            languageServerTrace,
            this.logger
        );
        this.clientOptions = {
            outputChannel: options.outputChannel,
            documentSelector: [{ language: RazorLanguage.id, pattern: RazorLanguage.globbingPattern }],
        };

        const args: string[] = [];

        this.logger.logMessage(`Razor language server path: ${options.serverPath}`);

        args.push('--logLevel');
        args.push(options.logLevel.toString());
        this.razorTelemetryReporter.reportTraceLevel(options.logLevel);

        if (options.debug) {
            this.razorTelemetryReporter.reportDebugLanguageServer();

            this.logger.logMessage('Debug flag set for Razor Language Server.');
            args.push('--debug');
        }

        // TODO: When all of this code is on GitHub, should we just pass `--omnisharp` as a flag to rzls, and let it decide?
        if (!options.usingOmniSharp) {
            args.push('--DelegateToCSharpOnDiagnosticPublish');
            args.push('true');
            args.push('--UpdateBuffersForClosedDocuments');
            args.push('true');
            args.push('--SingleServerCompletionSupport');
            args.push('true');

            if (this.isCSharpDevKitActivated) {
                args.push('--sessionId', getSessionId());
            }
        }

        let childProcess: () => Promise<cp.ChildProcessWithoutNullStreams>;
        const cpOptions: cp.SpawnOptionsWithoutStdio = {
            detached: true,
            windowsHide: true,
            env: this.env,
        };

        if (options.serverPath.endsWith('.dll')) {
            // If we were given a path to a dll, launch that via dotnet.
            const argsWithPath = [options.serverPath].concat(args);
            this.logger.logMessage(`Server arguments ${argsWithPath.join(' ')}`);

            childProcess = async () => cp.spawn(this.dotnetExecutablePath, argsWithPath, cpOptions);
        } else {
            // Otherwise assume we were given a path to an executable.
            this.logger.logMessage(`Server arguments ${args.join(' ')}`);

            childProcess = async () => cp.spawn(options.serverPath, args, cpOptions);
        }

        this.serverOptions = childProcess;

        this.client = new LanguageClient(
            'razorLanguageServer',
            'Razor Language Server',
            this.serverOptions,
            this.clientOptions
        );
    }
}

// VS code will have a default session id when running under tests. Since we may still
// report telemetry, we need to give a unique session id instead of the default value.
function getSessionId(): string {
    const sessionId = vscode.env.sessionId;

    // 'somevalue.sessionid' is the test session id provided by vs code
    if (sessionId.toLowerCase() === 'somevalue.sessionid') {
        return randomUUID();
    }

    return sessionId;
}

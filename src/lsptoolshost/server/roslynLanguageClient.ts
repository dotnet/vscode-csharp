/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ChildProcess } from 'child_process';
import { LanguageClient, ServerOptions } from 'vscode-languageclient/node';
import {
    CancellationToken,
    ErrorHandler,
    LanguageClientOptions,
    MessageSignature,
    MessageTransports,
    State,
} from 'vscode-languageclient';
import CompositeDisposable from '../../compositeDisposable';
import { IDisposable } from '../../disposable';
import { languageServerOptions } from '../../shared/options';
import { RoslynLspErrorCodes } from './roslynProtocol';
import { showErrorMessageWithOptions } from '../../shared/observers/utils/showMessage';
import { ITelemetryReporter } from '../../shared/telemetryReporter';
import { TelemetryEventNames } from '../../shared/telemetryEventNames';

/**
 * How long to wait for the server process to be reaped after the connection closes (which can happen milliseconds before the process actually exits)
 */
const serverExitTimeoutMs = 1000;

/**
 * Implementation of the base LanguageClient type that allows for additional items to be disposed of
 * when the base LanguageClient instance is disposed.
 */
export class RoslynLanguageClient extends LanguageClient {
    private readonly _disposables: CompositeDisposable;
    private readonly _csharpOutputWindow: vscode.OutputChannel;
    private readonly _telemetryReporter: ITelemetryReporter;

    /**
     * Tracks if we've shown a connection close notification for the server session to
     * prevent notification spam when the server crashes.
     * This is reset when the server restarts.
     */
    private _hasShownConnectionClose = false;

    /**
     * Resolves when the process exits, true when the server process was terminated externally.
     */
    private _serverExit: Promise<boolean> | undefined;

    constructor(
        id: string,
        name: string,
        serverOptions: ServerOptions,
        clientOptions: LanguageClientOptions,
        telemetryReporter: ITelemetryReporter,
        csharpOutputWindow: vscode.OutputChannel,
        forceDebug?: boolean
    ) {
        super(id, name, serverOptions, clientOptions, forceDebug);

        this._disposables = new CompositeDisposable();
        this._csharpOutputWindow = csharpOutputWindow;
        this._telemetryReporter = telemetryReporter;

        this.registerStateChangeHandler();
    }

    private registerStateChangeHandler() {
        this.onDidChangeState((e) => {
            if (e.newState === State.Running) {
                this._hasShownConnectionClose = false;
            }
        });
    }

    override async dispose(timeout?: number | undefined): Promise<void> {
        this._disposables.dispose();
        return super.dispose(timeout);
    }

    protected override async createMessageTransports(encoding: string): Promise<MessageTransports> {
        const transports = await super.createMessageTransports(encoding);
        this._serverExit = waitForExternalTermination(this.serverProcess);
        return transports;
    }

    override handleFailedRequest<T>(
        type: MessageSignature,
        token: CancellationToken | undefined,
        error: any,
        defaultValue: T,
        showNotification?: boolean
    ) {
        if (error.code == RoslynLspErrorCodes.nonFatalRequestFailure) {
            return super.handleFailedRequest(type, token, error, defaultValue, false);
        }

        // Temporarily allow LSP error toasts to be suppressed if configured.
        // There are a few architectural issues preventing us from solving some of the underlying problems,
        // for example Razor cohosting to fix text mismatch issues and unification of serialization libraries
        // to fix URI identification issues.  Once resolved, we should remove this option.
        //
        // See also https://github.com/microsoft/vscode-dotnettools/issues/722
        // https://github.com/dotnet/vscode-csharp/issues/6973
        // https://github.com/microsoft/vscode-languageserver-node/issues/1449
        if (languageServerOptions.suppressLspErrorToasts) {
            return super.handleFailedRequest(type, token, error, defaultValue, false);
        }

        return super.handleFailedRequest(type, token, error, defaultValue, showNotification);
    }

    /**
     * The default error handler handles server crashes and connection lost issues.
     * This is not to be confused with the override of the error method specifically, which handles
     * display any error (including both request failures and critical errors from here).
     */
    override createDefaultErrorHandler(maxRestartCount?: number): ErrorHandler {
        const defaultHandler = super.createDefaultErrorHandler(maxRestartCount);

        // the error function here is called for errors writing or reading from the connection.  the closed function is called when the connection is closed.
        // note that both of these can be called in the crash scenario, so we de-dupe notifications here.
        return {
            error: async (error, message, count) => {
                this.showCrashNotification();
                // The default error handler will determine if the server should be restarted.  We just want to ensure a good notification, so we defer to the default handler for that logic.
                const defaultResult = await defaultHandler.error(error, message, count);
                // The handled property indicates to the default handling that we've displayed our own notification.
                defaultResult.handled = true;
                return defaultResult;
            },
            closed: async () => {
                this.showCrashNotification();
                const defaultResult = await defaultHandler.closed();
                defaultResult.handled = true;
                return defaultResult;
            },
        };
    }

    /**
     * Handles displaying any errors reported by the language client.  This is called for both standard request failures
     * as well as critical server errors (e.g. crashes).
     */
    override error(message: string, data?: any, showNotification?: boolean | 'force'): void {
        // When the server crashes, we may get single method request failures due to the closed connection.
        // To avoid spamming users, don't display error toasts for these.
        if (this._hasShownConnectionClose) {
            showNotification = false;
        }

        // We have an error but we're not in a crash scenario.  Override the default error toast with one that includes the report issue command.
        if (showNotification) {
            showNotification = false;
            showErrorMessageWithOptions(
                vscode,
                message,
                { modal: false },
                {
                    title: vscode.l10n.t('Go to output'),
                    action: async () => {
                        this._csharpOutputWindow.show(true);
                    },
                },
                {
                    title: vscode.l10n.t('Report Issue'),
                    command: 'csharp.reportIssue',
                }
            );
        }

        super.error(message, data, showNotification);
    }

    /**
     * Adds a disposable that should be disposed of when the LanguageClient instance gets disposed.
     */
    public addDisposable(disposable: IDisposable) {
        this._disposables.add(disposable);
    }

    private showCrashNotification() {
        if (this._hasShownConnectionClose) {
            return;
        }

        // Set the guard before awaiting so the error and closed handlers cannot both get past it.
        this._hasShownConnectionClose = true;
        void this.showCrashNotificationAsync();
    }

    /**
     * Waits for the server process to exit, racing with a timeout.
     * Reports false if the process outlives the connection.
     */
    private async waitForProcessExit(): Promise<boolean> {
        if (this._serverExit === undefined) {
            return false;
        }

        let timeout: NodeJS.Timeout | undefined;
        try {
            return await Promise.race([
                this._serverExit,
                new Promise<false>((resolve) => {
                    timeout = setTimeout(() => resolve(false), serverExitTimeoutMs);
                }),
            ]);
        } finally {
            clearTimeout(timeout);
        }
    }

    private async showCrashNotificationAsync(): Promise<void> {
        const externallyTerminated = await this.waitForProcessExit();

        this._telemetryReporter.sendTelemetryEvent(TelemetryEventNames.ServerCrash, {
            externallyTerminated: externallyTerminated.toString(),
        });

        this.showCrashNotificationCore(externallyTerminated);
    }

    private showCrashNotificationCore(externallyTerminated: boolean) {
        const restartCommand = {
            title: vscode.l10n.t('Restart extensions'),
            command: 'workbench.action.restartExtensionHost',
        };
        if (externallyTerminated) {
            // Show a notification without a report issue command - there's nothing we can if the server
            // was terminated by some external process.
            showErrorMessageWithOptions(
                vscode,
                vscode.l10n.t(
                    'The C# language server was terminated externally. Restart extensions to re-enable C# functionality.'
                ),
                { modal: false },
                restartCommand
            );
        } else {
            showErrorMessageWithOptions(
                vscode,
                vscode.l10n.t('The C# language server has crashed. Restart extensions to re-enable C# functionality.'),
                { modal: false },
                restartCommand,
                {
                    title: vscode.l10n.t('Report Issue'),
                    action: async () => {
                        vscode.commands.executeCommand('csharp.reportIssue');
                        // Re-show the notification so the user can still restart extensions after reporting.
                        this.showCrashNotificationCore(externallyTerminated);
                    },
                }
            );
        }
    }
}

/**
 * Resolves when the server process exits, reporting whether it was stopped externally or not.
 * Note that this is only reliable on non-windows platforms - on windows a killed process has no signal and can have any exit code.
 */
function waitForExternalTermination(serverProcess: ChildProcess | undefined): Promise<boolean> | undefined {
    if (serverProcess === undefined) {
        return undefined;
    }

    return new Promise<boolean>((resolve) => {
        serverProcess.once('exit', (code, signal) => {
            resolve(
                // SIGKILL cannot be caught, blocked, or ignored, so it was sent by an external process.
                signal === 'SIGKILL' ||
                    // .NET normally handles SIGTERM and exits with 128 + SIGTERM instead of reporting the signal.
                    code === 143 ||
                    // The PAL re-raises SIGTERM on some paths.
                    signal === 'SIGTERM'
            );
        });
    });
}

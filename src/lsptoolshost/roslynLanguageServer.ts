/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as uuid from 'uuid';
import * as net from 'net';
import { registerCommands } from './commands';
import { registerDebugger } from './debugger';
import { UriConverter } from './uriConverter';

import {
    LanguageClientOptions,
    ServerOptions,
    State,
    Trace,
    RequestType,
    RequestType0,
    PartialResultParams,
    ProtocolRequestType,
    SocketMessageWriter,
    SocketMessageReader,
    MessageTransports,
    RAL,
    CancellationToken,
} from 'vscode-languageclient/node';
import { PlatformInformation } from '../shared/platform';
import { readConfigurations } from './configurationMiddleware';
import { DynamicFileInfoHandler } from '../razor/src/dynamicFile/dynamicFileInfoHandler';
import ShowInformationMessage from '../shared/observers/utils/showInformationMessage';
import * as RoslynProtocol from './roslynProtocol';
import { CSharpDevKitExports } from '../csharpDevKitExports';
import { SolutionSnapshotId } from './services/ISolutionSnapshotProvider';
import { ServerStateChange } from './serverStateChange';
import TelemetryReporter from '@vscode/extension-telemetry';
import CSharpIntelliCodeExports from '../csharpIntelliCodeExports';
import { csharpDevkitExtensionId, csharpDevkitIntelliCodeExtensionId, getCSharpDevKit } from '../utils/getCSharpDevKit';
import { randomUUID } from 'crypto';
import { DotnetRuntimeExtensionResolver } from './dotnetRuntimeExtensionResolver';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';
import { RoslynLanguageClient } from './roslynLanguageClient';
import { registerUnitTestingCommands } from './unitTesting';
import { reportProjectConfigurationEvent } from '../shared/projectConfiguration';
import { getDotnetInfo } from '../shared/utils/getDotnetInfo';
import { registerLanguageServerOptionChanges } from './optionChanges';
import { Observable } from 'rxjs';
import { DotnetInfo } from '../shared/utils/dotnetInfo';
import { RoslynLanguageServerEvents } from './languageServerEvents';
import { registerShowToastNotification } from './showToastNotification';
import { registerRazorCommands } from './razorCommands';
import { registerOnAutoInsert } from './onAutoInsert';
import { registerCodeActionFixAllCommands } from './fixAllCodeAction';
import { commonOptions, languageServerOptions, omnisharpOptions } from '../shared/options';
import { NamedPipeInformation } from './roslynProtocol';
import { IDisposable } from '../disposable';
import { registerNestedCodeActionCommands } from './nestedCodeAction';
import { registerRestoreCommands } from './restore';
import { BuildDiagnosticsService } from './buildDiagnosticsService';

let _channel: vscode.OutputChannel;
let _traceChannel: vscode.OutputChannel;

// Flag indicating if C# Devkit was installed the last time we activated.
// Used to determine if we need to restart the server on extension changes.
let _wasActivatedWithCSharpDevkit: boolean | undefined;

export class RoslynLanguageServer {
    // These are notifications we will get from the LSP server and will forward to the Razor extension.
    private static readonly provideRazorDynamicFileInfoMethodName: string = 'razor/provideDynamicFileInfo';
    private static readonly removeRazorDynamicFileInfoMethodName: string = 'razor/removeDynamicFileInfo';

    /**
     * The encoding to use when writing to and from the stream.
     */
    private static readonly encoding: RAL.MessageBufferEncoding = 'utf-8';

    /**
     * The regular expression used to find the named pipe key in the LSP server's stdout stream.
     */
    private static readonly namedPipeKeyRegex = /{"pipeName":"[^"]+"}/;

    /**
     * The timeout for stopping the language server (in ms).
     */
    private static _stopTimeout = 10000;

    /**
     * The solution file previously opened; we hold onto this so we can send this back over if the server were to be relaunched for any reason, like some other configuration
     * change that required the server to restart, or some other catastrophic failure that completely took down the process. In the case that the process is crashing because
     * of trying to load this solution file, we'll rely on VS Code's support to eventually stop relaunching the LSP server entirely.
     */
    private _solutionFile: vscode.Uri | undefined;

    /** The project files previously opened; we hold onto this for the same reason as _solutionFile. */
    private _projectFiles: vscode.Uri[] = new Array<vscode.Uri>();

    public _buildDiagnosticService: BuildDiagnosticsService;

    constructor(
        private _languageClient: RoslynLanguageClient,
        private _platformInfo: PlatformInformation,
        private _context: vscode.ExtensionContext,
        private _telemetryReporter: TelemetryReporter,
        private _languageServerEvents: RoslynLanguageServerEvents
    ) {
        this.registerSetTrace();
        this.registerSendOpenSolution();
        this.registerOnProjectInitializationComplete();
        this.registerReportProjectConfiguration();
        this.registerExtensionsChanged();
        this.registerTelemetryChanged();

        const diagnosticsReportedByBuild = vscode.languages.createDiagnosticCollection('csharp-build');
        this._buildDiagnosticService = new BuildDiagnosticsService(diagnosticsReportedByBuild);
        this.registerDocumentOpenForDiagnostics();

        // Register Razor dynamic file info handling
        this.registerDynamicFileInfo();

        this.registerDebuggerAttach();

        registerShowToastNotification(this._languageClient);
    }

    private registerSetTrace() {
        // Set the language client trace level based on the log level option.
        // setTrace only works after the client is already running.
        this._languageClient.onDidChangeState(async (state) => {
            if (state.newState === State.Running) {
                const languageClientTraceLevel = RoslynLanguageServer.GetTraceLevel(languageServerOptions.logLevel);

                await this._languageClient.setTrace(languageClientTraceLevel);
            }
        });
    }

    private registerSendOpenSolution() {
        this._languageClient.onDidChangeState(async (state) => {
            if (state.newState === State.Running) {
                if (this._solutionFile || this._projectFiles.length > 0) {
                    await this.sendOpenSolutionAndProjectsNotifications();
                } else {
                    await this.openDefaultSolutionOrProjects();
                }
                await this.sendOrSubscribeForServiceBrokerConnection();
                this._languageServerEvents.onServerStateChangeEmitter.fire(ServerStateChange.Started);
            }
        });
    }

    private registerOnProjectInitializationComplete() {
        this._languageClient.onNotification(RoslynProtocol.ProjectInitializationCompleteNotification.type, () => {
            this._languageServerEvents.onServerStateChangeEmitter.fire(ServerStateChange.ProjectInitializationComplete);
        });
    }

    private registerReportProjectConfiguration() {
        // Store the dotnet info outside of the notification so we're not running dotnet --info every time the project changes.
        let dotnetInfo: DotnetInfo | undefined = undefined;
        this._languageClient.onNotification(RoslynProtocol.ProjectConfigurationNotification.type, async (params) => {
            if (!dotnetInfo) {
                dotnetInfo = await getDotnetInfo([]);
            }
            reportProjectConfigurationEvent(
                this._telemetryReporter,
                params,
                this._platformInfo,
                dotnetInfo,
                this._solutionFile?.fsPath,
                true
            );
        });
    }

    /**
     * Resolves server options and starts the dotnet language server process.
     * This promise will complete when the server starts.
     */
    public static async initializeAsync(
        platformInfo: PlatformInformation,
        hostExecutableResolver: IHostExecutableResolver,
        context: vscode.ExtensionContext,
        telemetryReporter: TelemetryReporter,
        additionalExtensionPaths: string[],
        languageServerEvents: RoslynLanguageServerEvents
    ): Promise<RoslynLanguageServer> {
        const serverOptions: ServerOptions = async () => {
            return await this.startServer(
                platformInfo,
                hostExecutableResolver,
                context,
                telemetryReporter,
                additionalExtensionPaths
            );
        };

        const documentSelector = languageServerOptions.documentSelector;

        // Options to control the language client
        const clientOptions: LanguageClientOptions = {
            // Register the server for plain csharp documents
            documentSelector: documentSelector,
            synchronize: {
                fileEvents: [],
            },
            traceOutputChannel: _traceChannel,
            outputChannel: _channel,
            uriConverters: {
                // VSCode encodes the ":" as "%3A" in file paths, for example "file:///c%3A/Users/dabarbet/source/repos/ConsoleApp8/ConsoleApp8/Program.cs".
                // System.Uri does not decode the LocalPath property correctly into a valid windows path, instead you get something like
                // "/c:/Users/dabarbet/source/repos/ConsoleApp8/ConsoleApp8/Program.cs" (note the incorrect forward slashes and prepended "/").
                // Properly decoded, it would look something like "c:\Users\dabarbet\source\repos\ConsoleApp8\ConsoleApp8\Program.cs"
                // So instead we decode the URI here before sending to the server.
                code2Protocol: UriConverter.serialize,
                protocol2Code: UriConverter.deserialize,
            },
            middleware: {
                workspace: {
                    configuration: (params) => readConfigurations(params),
                },
            },
        };

        // Create the language client and start the client.
        const client = new RoslynLanguageClient(
            'microsoft-codeanalysis-languageserver',
            'Microsoft.CodeAnalysis.LanguageServer',
            serverOptions,
            clientOptions
        );

        client.registerProposedFeatures();

        const server = new RoslynLanguageServer(client, platformInfo, context, telemetryReporter, languageServerEvents);

        // Start the client. This will also launch the server process.
        await client.start();
        return server;
    }

    public async stop(): Promise<void> {
        await this._languageClient.stop(RoslynLanguageServer._stopTimeout);
    }

    public async restart(): Promise<void> {
        await this._languageClient.restart();
    }

    /**
     * Returns whether or not the underlying LSP server is running or not.
     */
    public isRunning(): boolean {
        return this._languageClient.state === State.Running;
    }

    /**
     * Makes an LSP request to the server with a given type and parameters.
     */
    public async sendRequest<Params, Response, Error>(
        type: RequestType<Params, Response, Error>,
        params: Params,
        token: vscode.CancellationToken
    ): Promise<Response> {
        if (!this.isRunning()) {
            throw new Error('Tried to send request while server is not started.');
        }

        const response = await this._languageClient.sendRequest(type, params, token);
        return response;
    }

    /**
     * Makes an LSP request to the server with a given type and no parameters
     */
    public async sendRequest0<Response, Error>(
        type: RequestType0<Response, Error>,
        token: vscode.CancellationToken
    ): Promise<Response> {
        if (!this.isRunning()) {
            throw new Error('Tried to send request while server is not started.');
        }

        const response = await this._languageClient.sendRequest(type, token);
        return response;
    }

    public async sendRequestWithProgress<P extends PartialResultParams, R, PR, E, RO>(
        type: ProtocolRequestType<P, R, PR, E, RO>,
        params: P,
        onProgress: (p: PR) => Promise<any>,
        cancellationToken?: vscode.CancellationToken
    ): Promise<R> {
        // Generate a UUID for our partial result token and apply it to our request.
        const partialResultToken: string = uuid.v4();
        params.partialResultToken = partialResultToken;
        // Register the callback for progress events.
        const disposable = this._languageClient.onProgress(type, partialResultToken, async (partialResult) => {
            await onProgress(partialResult);
        });
        const response = await this._languageClient
            .sendRequest(type, params, cancellationToken)
            .finally(() => disposable.dispose());
        return response;
    }

    /**
     * Sends an LSP notification to the server with a given method and parameters.
     */
    public async sendNotification<Params>(method: string, params: Params): Promise<any> {
        if (!this.isRunning()) {
            throw new Error('Tried to send request while server is not started.');
        }

        const response = await this._languageClient.sendNotification(method, params);
        return response;
    }

    public async registerSolutionSnapshot(token: vscode.CancellationToken): Promise<SolutionSnapshotId> {
        const response = await this.sendRequest0(RoslynProtocol.RegisterSolutionSnapshotRequest.type, token);
        if (response) {
            return new SolutionSnapshotId(response.id);
        }

        throw new Error('Unable to retrieve current solution.');
    }

    public async openSolution(solutionFile: vscode.Uri): Promise<void> {
        this._solutionFile = solutionFile;
        this._projectFiles = [];
        await this.sendOpenSolutionAndProjectsNotifications();
    }

    public async openProjects(projectFiles: vscode.Uri[]): Promise<void> {
        this._solutionFile = undefined;
        this._projectFiles = projectFiles;
        await this.sendOpenSolutionAndProjectsNotifications();
    }

    private async sendOpenSolutionAndProjectsNotifications(): Promise<void> {
        if (this._languageClient.isRunning()) {
            if (this._solutionFile !== undefined) {
                const protocolUri = this._languageClient.clientOptions.uriConverters!.code2Protocol(this._solutionFile);
                await this._languageClient.sendNotification(RoslynProtocol.OpenSolutionNotification.type, {
                    solution: protocolUri,
                });
            }

            if (this._projectFiles.length > 0) {
                const projectProtocolUris = this._projectFiles.map((uri) =>
                    this._languageClient.clientOptions.uriConverters!.code2Protocol(uri)
                );
                await this._languageClient.sendNotification(RoslynProtocol.OpenProjectNotification.type, {
                    projects: projectProtocolUris,
                });
            }
        }
    }

    private async openDefaultSolutionOrProjects(): Promise<void> {
        // If Dev Kit isn't installed, then we are responsible for picking the solution to open, assuming the user hasn't explicitly
        // disabled it.
        const defaultSolution = commonOptions.defaultSolution;
        if (!_wasActivatedWithCSharpDevkit && defaultSolution !== 'disable' && this._solutionFile === undefined) {
            if (defaultSolution !== '') {
                this.openSolution(vscode.Uri.file(defaultSolution));
            } else {
                // Auto open if there is just one solution target; if there's more the one we'll just let the user pick with the picker.
                const solutionUris = await vscode.workspace.findFiles('**/*.sln', '**/node_modules/**', 2);
                if (solutionUris) {
                    if (solutionUris.length === 1) {
                        this.openSolution(solutionUris[0]);
                    } else if (solutionUris.length > 1) {
                        // We have more than one solution, so we'll prompt the user to use the picker.
                        const chosen = await vscode.window.showInformationMessage(
                            vscode.l10n.t(
                                'Your workspace has multiple Visual Studio Solution files; please select one to get full IntelliSense.'
                            ),
                            { title: vscode.l10n.t('Choose'), action: 'open' },
                            { title: vscode.l10n.t('Choose and set default'), action: 'openAndSetDefault' },
                            { title: vscode.l10n.t('Do not load any'), action: 'disable' }
                        );

                        if (chosen) {
                            if (chosen.action === 'disable') {
                                vscode.workspace.getConfiguration().update('dotnet.defaultSolution', 'disable', false);
                            } else {
                                const chosenSolution: vscode.Uri | undefined = await vscode.commands.executeCommand(
                                    'dotnet.openSolution'
                                );
                                if (chosen.action === 'openAndSetDefault' && chosenSolution) {
                                    const relativePath = vscode.workspace.asRelativePath(chosenSolution);
                                    vscode.workspace
                                        .getConfiguration()
                                        .update('dotnet.defaultSolution', relativePath, false);
                                }
                            }
                        }
                    } else if (solutionUris.length === 0) {
                        // We have no solutions, so we'll enumerate what project files we have and just use those.
                        const projectUris = await vscode.workspace.findFiles(
                            '**/*.csproj',
                            '**/node_modules/**',
                            omnisharpOptions.maxProjectResults
                        );

                        this.openProjects(projectUris);
                    }
                }
            }
        }
    }

    private async sendOrSubscribeForServiceBrokerConnection(): Promise<void> {
        const csharpDevKitExtension = getCSharpDevKit();
        if (csharpDevKitExtension) {
            const exports = await csharpDevKitExtension.activate();

            // If the server process has already loaded, we'll get the pipe name and send it over to our process; otherwise we'll wait until the Dev Kit server
            // is launched and then send the pipe name over. This avoids us calling getBrokeredServiceServerPipeName() which will launch the server
            // if it's not already running. The rationale here is if Dev Kit is installed, we defer to it for the project system loading; if it's not loaded,
            // then we have no projects, and so this extension won't have anything to do.
            if (exports.hasServerProcessLoaded()) {
                const pipeName = await exports.getBrokeredServiceServerPipeName();
                this._languageClient.sendNotification('serviceBroker/connect', { pipeName: pipeName });
            } else {
                // We'll subscribe if the process later launches, and call this function again to send the pipe name.
                this._context.subscriptions.push(
                    exports.serverProcessLoaded(async () => this.sendOrSubscribeForServiceBrokerConnection())
                );
            }
        }
    }

    public getServerCapabilities(): any {
        const capabilities: any = this._languageClient.initializeResult?.capabilities;
        return capabilities;
    }

    private static async startServer(
        platformInfo: PlatformInformation,
        hostExecutableResolver: IHostExecutableResolver,
        context: vscode.ExtensionContext,
        telemetryReporter: TelemetryReporter,
        additionalExtensionPaths: string[]
    ): Promise<MessageTransports> {
        const serverPath = getServerPath(platformInfo);

        const dotnetInfo = await hostExecutableResolver.getHostExecutableInfo();
        const dotnetRuntimePath = path.dirname(dotnetInfo.path);
        const dotnetExecutablePath = dotnetInfo.path;

        _channel.appendLine('Dotnet path: ' + dotnetExecutablePath);

        // Take care to always run .NET processes on the runtime that we intend.
        // The dotnet.exe we point to should not go looking for other runtimes.
        const env: NodeJS.ProcessEnv = { ...process.env };
        env.DOTNET_ROOT = dotnetRuntimePath;
        env.DOTNET_MULTILEVEL_LOOKUP = '0';
        // Save user's DOTNET_ROOT env-var value so server can recover the user setting when needed
        env.DOTNET_ROOT_USER = process.env.DOTNET_ROOT ?? 'EMPTY';

        if (languageServerOptions.crashDumpPath) {
            // Enable dump collection
            env.DOTNET_DbgEnableMiniDump = '1';
            // Collect heap dump
            env.DOTNET_DbgMiniDumpType = '2';
            // Collect crashreport.json with additional thread and stack frame information.
            env.DOTNET_EnableCrashReport = '1';
            // The dump file name format is <executable>.<pid>.dmp
            env.DOTNET_DbgMiniDumpName = path.join(languageServerOptions.crashDumpPath, '%e.%p.dmp');
        }

        let args: string[] = [];

        if (commonOptions.waitForDebugger) {
            args.push('--debug');
        }

        const logLevel = languageServerOptions.logLevel;
        if (logLevel) {
            args.push('--logLevel', logLevel);
        }

        for (const extensionPath of additionalExtensionPaths) {
            args.push('--extension', extensionPath);
        }

        // Get the brokered service pipe name from C# Dev Kit (if installed).
        // We explicitly call this in the LSP server start action instead of awaiting it
        // in our activation because C# Dev Kit depends on C# activation completing.
        const csharpDevkitExtension = getCSharpDevKit();
        if (csharpDevkitExtension) {
            _wasActivatedWithCSharpDevkit = true;

            // Get the starred suggestion dll location from C# Dev Kit IntelliCode (if both C# Dev Kit and C# Dev Kit IntelliCode are installed).
            const csharpDevkitIntelliCodeExtension = vscode.extensions.getExtension<CSharpIntelliCodeExports>(
                csharpDevkitIntelliCodeExtensionId
            );
            if (csharpDevkitIntelliCodeExtension) {
                _channel.appendLine('Activating C# + C# Dev Kit + C# IntelliCode...');
                const csharpDevkitIntelliCodeArgs = await this.getCSharpDevkitIntelliCodeExportArgs(
                    csharpDevkitIntelliCodeExtension
                );
                args = args.concat(csharpDevkitIntelliCodeArgs);
            } else {
                _channel.appendLine('Activating C# + C# Dev Kit...');
            }

            const csharpDevKitArgs = this.getCSharpDevKitExportArgs();
            args = args.concat(csharpDevKitArgs);

            await this.setupDevKitEnvironment(env, csharpDevkitExtension);
        } else {
            // C# Dev Kit is not installed - continue C#-only activation.
            _channel.appendLine('Activating C# standalone...');
            vscode.commands.executeCommand('setContext', 'dotnet.server.activatedStandalone', true);
            _wasActivatedWithCSharpDevkit = false;
        }

        if (logLevel && [Trace.Messages, Trace.Verbose].includes(this.GetTraceLevel(logLevel))) {
            _channel.appendLine(`Starting server at ${serverPath}`);
        }

        // shouldn't this arg only be set if it's running with CSDevKit?
        args.push('--telemetryLevel', telemetryReporter.telemetryLevel);

        args.push('--extensionLogDirectory', context.logUri.fsPath);

        let childProcess: cp.ChildProcessWithoutNullStreams;
        const cpOptions: cp.SpawnOptionsWithoutStdio = {
            detached: true,
            windowsHide: true,
            env: env,
        };

        if (serverPath.endsWith('.dll')) {
            // If we were given a path to a dll, launch that via dotnet.
            const argsWithPath = [serverPath].concat(args);

            if (logLevel && [Trace.Messages, Trace.Verbose].includes(this.GetTraceLevel(logLevel))) {
                _channel.appendLine(`Server arguments ${argsWithPath.join(' ')}`);
            }

            childProcess = cp.spawn(dotnetExecutablePath, argsWithPath, cpOptions);
        } else {
            // Otherwise assume we were given a path to an executable.
            if (logLevel && [Trace.Messages, Trace.Verbose].includes(this.GetTraceLevel(logLevel))) {
                _channel.appendLine(`Server arguments ${args.join(' ')}`);
            }

            childProcess = cp.spawn(serverPath, args, cpOptions);
        }

        // Record the stdout and stderr streams from the server process.
        childProcess.stdout.on('data', (data: { toString: (arg0: any) => any }) => {
            const result: string = isString(data) ? data : data.toString(RoslynLanguageServer.encoding);
            _channel.append('[stdout] ' + result);
        });
        childProcess.stderr.on('data', (data: { toString: (arg0: any) => any }) => {
            const result: string = isString(data) ? data : data.toString(RoslynLanguageServer.encoding);
            _channel.append('[stderr] ' + result);
        });

        // Timeout promise used to time out the connection process if it takes too long.
        const timeout = new Promise<undefined>((resolve, reject) => {
            RAL().timer.setTimeout(resolve, languageServerOptions.startTimeout);

            // If the child process exited unexpectedly, reject the promise early.
            // Error information will be captured from the stdout/stderr streams above.
            childProcess.on('exit', (code) => {
                if (code && code !== 0) {
                    const message = `Language server process exited with ${code}`;
                    _channel.appendLine(message);
                    reject(new Error(message));
                }
            });
        });

        // The server process will create the named pipe used for communication. Wait for it to be created,
        // and listen for the server to pass back the connection information via stdout.
        const namedPipeConnectionPromise = new Promise<NamedPipeInformation>((resolve) => {
            _channel.appendLine('waiting for named pipe information from server...');
            childProcess.stdout.on('data', (data: { toString: (arg0: any) => any }) => {
                const result: string = isString(data) ? data : data.toString(RoslynLanguageServer.encoding);
                // Use the regular expression to find all JSON lines
                const jsonLines = result.match(RoslynLanguageServer.namedPipeKeyRegex);
                if (jsonLines) {
                    const transmittedPipeNameInfo: NamedPipeInformation = JSON.parse(jsonLines[0]);
                    _channel.appendLine('received named pipe information from server');
                    resolve(transmittedPipeNameInfo);
                }
            });
        });

        // Wait for the server to send back the name of the pipe to connect to.
        // If it takes too long it will timeout and throw an error.
        const pipeConnectionInfo = await Promise.race([namedPipeConnectionPromise, timeout]);
        if (pipeConnectionInfo === undefined) {
            throw new Error('Timeout. Named pipe information not received from server.');
        }

        const socketPromise = new Promise<net.Socket>((resolve) => {
            _channel.appendLine('attempting to connect client to server...');
            const socket = net.createConnection(pipeConnectionInfo.pipeName, () => {
                _channel.appendLine('client has connected to server');
                resolve(socket);
            });
        });

        // Wait for the client to connect to the named pipe.
        // If it takes too long it will timeout and throw an error.
        const socket = await Promise.race([socketPromise, timeout]);
        if (socket === undefined) {
            throw new Error(
                'Timeout. Client cound not connect to server via named pipe: ' + pipeConnectionInfo.pipeName
            );
        }

        return {
            reader: new SocketMessageReader(socket, RoslynLanguageServer.encoding),
            writer: new SocketMessageWriter(socket, RoslynLanguageServer.encoding),
        };
    }

    private registerDynamicFileInfo() {
        // When the Roslyn language server sends a request for Razor dynamic file info, we forward that request along to Razor via
        // a command.
        this._languageClient.onRequest(RoslynLanguageServer.provideRazorDynamicFileInfoMethodName, async (request) =>
            vscode.commands.executeCommand(DynamicFileInfoHandler.provideDynamicFileInfoCommand, request)
        );
        this._languageClient.onNotification(
            RoslynLanguageServer.removeRazorDynamicFileInfoMethodName,
            async (notification) =>
                vscode.commands.executeCommand(DynamicFileInfoHandler.removeDynamicFileInfoCommand, notification)
        );
    }

    // eslint-disable-next-line @typescript-eslint/promise-function-async
    private WaitForAttachCompleteAsync(attachRequestId: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            let didTerminateRegistation: IDisposable | null = null;
            let customEventReg: IDisposable | null = null;
            let isComplete = false;

            const fire = (result: boolean) => {
                if (isComplete === false) {
                    isComplete = true;
                    didTerminateRegistation?.dispose();
                    customEventReg?.dispose();
                    resolve(result);
                }
            };

            didTerminateRegistation = vscode.debug.onDidTerminateDebugSession((session: vscode.DebugSession) => {
                if (session.configuration.attachRequestId !== attachRequestId) {
                    return;
                }

                fire(false);
            });

            customEventReg = vscode.debug.onDidReceiveDebugSessionCustomEvent(
                (event: vscode.DebugSessionCustomEvent) => {
                    if (event.session.configuration.attachRequestId !== attachRequestId) {
                        return;
                    }

                    if (event.event !== 'attachComplete') {
                        return;
                    }

                    fire(true);
                }
            );
        });
    }

    private registerDebuggerAttach() {
        this._languageClient.onRequest<RoslynProtocol.DebugAttachParams, RoslynProtocol.DebugAttachResult, void>(
            RoslynProtocol.DebugAttachRequest.type,
            async (request) => {
                const debugOptions = commonOptions.unitTestDebuggingOptions;
                const debugConfiguration: vscode.DebugConfiguration = {
                    ...debugOptions,
                    name: '.NET Debug Unit test',
                    type: 'coreclr',
                    request: 'attach',
                    processId: request.processId,
                    attachRequestId: randomUUID(),
                };

                const waitCompletePromise = this.WaitForAttachCompleteAsync(debugConfiguration.attachRequestId);

                let success = await vscode.debug.startDebugging(undefined, debugConfiguration, undefined);
                if (!success) {
                    return { didAttach: false };
                }

                success = await waitCompletePromise;
                return { didAttach: success };
            }
        );
    }

    private registerDocumentOpenForDiagnostics() {
        // When a file is opened process any build diagnostics that may be shown
        this._languageClient.addDisposable(
            vscode.workspace.onDidOpenTextDocument(async (event) => {
                const buildIds = await this.getBuildOnlyDiagnosticIds(CancellationToken.None);
                this._buildDiagnosticService._onFileOpened(event, buildIds);
            })
        );
    }

    private registerExtensionsChanged() {
        // subscribe to extension change events so that we can get notified if C# Dev Kit is added/removed later.
        this._languageClient.addDisposable(
            vscode.extensions.onDidChange(async () => {
                const csharpDevkitExtension = getCSharpDevKit();

                if (_wasActivatedWithCSharpDevkit === undefined) {
                    // Haven't activated yet.
                    return;
                }

                const title = vscode.l10n.t('Restart Language Server');
                const command = 'dotnet.restartServer';
                if (csharpDevkitExtension && !_wasActivatedWithCSharpDevkit) {
                    // We previously started without C# Dev Kit and its now installed.
                    // Offer a prompt to restart the server to use C# Dev Kit.
                    _channel.appendLine(`Detected new installation of ${csharpDevkitExtensionId}`);
                    const message = `Detected installation of ${csharpDevkitExtensionId}. Would you like to relaunch the language server for added features?`;
                    ShowInformationMessage(vscode, message, { title, command });
                } else {
                    // Any other change to extensions is irrelevant - an uninstall requires a reload of the window
                    // which will automatically restart this extension too.
                }
            })
        );
    }

    private registerTelemetryChanged() {
        // Subscribe to telemetry events so we can enable/disable as needed
        this._languageClient.addDisposable(
            vscode.env.onDidChangeTelemetryEnabled((_: boolean) => {
                const title = 'Restart Language Server';
                const command = 'dotnet.restartServer';
                const message =
                    'Detected change in telemetry settings. These will not take effect until the language server is restarted, would you like to restart?';
                ShowInformationMessage(vscode, message, { title, command });
            })
        );
    }

    private static getCSharpDevKitExportArgs(): string[] {
        const args: string[] = [];

        const clientRoot = __dirname;
        const devKitDepsPath = path.join(
            clientRoot,
            '..',
            '.roslynDevKit',
            'Microsoft.VisualStudio.LanguageServices.DevKit.dll'
        );
        args.push('--extension', devKitDepsPath);

        args.push('--sessionId', getSessionId());
        return args;
    }

    private static async getCSharpDevkitIntelliCodeExportArgs(
        csharpDevkitIntelliCodeExtension: vscode.Extension<CSharpIntelliCodeExports>
    ): Promise<string[]> {
        const exports = await csharpDevkitIntelliCodeExtension.activate();

        const starredCompletionComponentPath = exports.components['@vsintellicode/starred-suggestions-csharp'];

        const csharpIntelliCodeArgs: string[] = ['--starredCompletionComponentPath', starredCompletionComponentPath];
        return csharpIntelliCodeArgs;
    }

    private static async setupDevKitEnvironment(
        env: NodeJS.ProcessEnv,
        csharpDevkitExtension: vscode.Extension<CSharpDevKitExports>
    ): Promise<void> {
        const exports: CSharpDevKitExports = await csharpDevkitExtension.activate();

        // setupTelemetryEnvironmentAsync was a later addition to devkit (not in preview 1)
        // so it may not exist in whatever version of devkit the user has installed
        if (!exports.setupTelemetryEnvironmentAsync) {
            return;
        }

        await exports.setupTelemetryEnvironmentAsync(env);
    }

    private static GetTraceLevel(logLevel: string): Trace {
        switch (logLevel) {
            case 'Trace':
                return Trace.Verbose;
            case 'Debug':
                return Trace.Messages;
            case 'Information':
                return Trace.Off;
            case 'Warning':
                return Trace.Off;
            case 'Error':
                return Trace.Off;
            case 'Critical':
                return Trace.Off;
            case 'None':
                return Trace.Off;
            default:
                _channel.appendLine(
                    `Invalid log level ${logLevel}, server will not start. Please set the 'dotnet.server.trace' configuration to a valid value`
                );
                throw new Error(`Invalid log level ${logLevel}`);
        }
    }

    public async getBuildOnlyDiagnosticIds(token: vscode.CancellationToken): Promise<string[]> {
        // If the server isn't running, no build diagnostics to get
        if (!this.isRunning()) {
            return [];
        }

        const response = await this.sendRequest0(RoslynProtocol.BuildOnlyDiagnosticIdsRequest.type, token);
        if (response) {
            return response.ids;
        }

        throw new Error('Unable to retrieve build-only diagnostic ids for current solution.');
    }
}

/**
 * Creates and activates the Roslyn language server.
 * The returned promise will complete when the server starts.
 */
export async function activateRoslynLanguageServer(
    context: vscode.ExtensionContext,
    platformInfo: PlatformInformation,
    optionObservable: Observable<void>,
    outputChannel: vscode.OutputChannel,
    dotnetTestChannel: vscode.OutputChannel,
    dotnetChannel: vscode.OutputChannel,
    reporter: TelemetryReporter,
    languageServerEvents: RoslynLanguageServerEvents
): Promise<RoslynLanguageServer> {
    // Create a channel for outputting general logs from the language server.
    _channel = outputChannel;
    // Create a separate channel for outputting trace logs - these are incredibly verbose and make other logs very difficult to see.
    _traceChannel = vscode.window.createOutputChannel('C# LSP Trace Logs');

    const hostExecutableResolver = new DotnetRuntimeExtensionResolver(
        platformInfo,
        getServerPath,
        outputChannel,
        context.extensionPath
    );
    const additionalExtensionPaths = scanExtensionPlugins();

    const languageServer = await RoslynLanguageServer.initializeAsync(
        platformInfo,
        hostExecutableResolver,
        context,
        reporter,
        additionalExtensionPaths,
        languageServerEvents
    );

    // Register any commands that need to be handled by the extension.
    registerCommands(context, languageServer, hostExecutableResolver, _channel);
    registerNestedCodeActionCommands(context, languageServer, _channel);
    registerCodeActionFixAllCommands(context, languageServer, _channel);

    registerRazorCommands(context, languageServer);

    registerUnitTestingCommands(context, languageServer, dotnetTestChannel);

    // Register any needed debugger components that need to communicate with the language server.
    registerDebugger(context, languageServer, languageServerEvents, platformInfo, _channel);

    registerRestoreCommands(context, languageServer, dotnetChannel);

    registerOnAutoInsert(languageServer);

    context.subscriptions.push(registerLanguageServerOptionChanges(optionObservable));

    return languageServer;

    function scanExtensionPlugins(): string[] {
        return vscode.extensions.all.flatMap((extension) => {
            let loadPaths = extension.packageJSON.contributes?.['csharpExtensionLoadPaths'];
            if (loadPaths === undefined || loadPaths === null) {
                _traceChannel.appendLine(`Extension ${extension.id} does not contribute csharpExtensionLoadPaths`);
                return [];
            }

            if (!Array.isArray(loadPaths) || loadPaths.some((loadPath) => typeof loadPath !== 'string')) {
                _channel.appendLine(
                    `Extension ${extension.id} has invalid csharpExtensionLoadPaths. Expected string array, found ${loadPaths}`
                );
                return [];
            }

            loadPaths = loadPaths.map((loadPath) => path.join(extension.extensionPath, loadPath));
            _traceChannel.appendLine(`Extension ${extension.id} contributes csharpExtensionLoadPaths: ${loadPaths}`);
            return loadPaths;
        });
    }
}

function getServerPath(platformInfo: PlatformInformation) {
    let serverPath = process.env.DOTNET_ROSLYN_SERVER_PATH;

    if (serverPath) {
        _channel.appendLine(`Using server path override from DOTNET_ROSLYN_SERVER_PATH: ${serverPath}`);
    } else {
        serverPath = commonOptions.serverPath;
        if (!serverPath) {
            // Option not set, use the path from the extension.
            serverPath = getInstalledServerPath(platformInfo);
        }
    }

    if (!fs.existsSync(serverPath)) {
        throw new Error(`Cannot find language server in path '${serverPath}'`);
    }

    return serverPath;
}

function getInstalledServerPath(platformInfo: PlatformInformation): string {
    const clientRoot = __dirname;
    const serverFilePath = path.join(clientRoot, '..', '.roslyn', 'Microsoft.CodeAnalysis.LanguageServer');

    let extension = '';
    if (platformInfo.isWindows()) {
        extension = '.exe';
    } else if (platformInfo.isMacOS()) {
        // MacOS executables must be signed with codesign.  Currently all Roslyn server executables are built on windows
        // and therefore dotnet publish does not automatically sign them.
        // Tracking bug - https://devdiv.visualstudio.com/DevDiv/_workitems/edit/1767519/
        extension = '.dll';
    }

    let pathWithExtension = `${serverFilePath}${extension}`;
    if (!fs.existsSync(pathWithExtension)) {
        // We might be running a platform neutral vsix which has no executable, instead we run the dll directly.
        pathWithExtension = `${serverFilePath}.dll`;
    }

    return pathWithExtension;
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

export function isString(value: any): value is string {
    return typeof value === 'string' || value instanceof String;
}

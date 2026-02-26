/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import {
    LanguageClientOptions,
    NotificationHandler,
    NotificationType,
    ProtocolRequestType,
} from 'vscode-languageclient';
import {
    Trace,
    RequestType,
    RequestType0,
    CancellationToken,
    RequestHandler,
    ResponseError,
    NotificationHandler0,
    PartialResultParams,
    State,
    Executable,
    TransportKind,
} from 'vscode-languageclient/node';
import { PlatformInformation } from '../../shared/platform';
import { readConfigurations } from '../options/configurationMiddleware';
import * as RoslynProtocol from './roslynProtocol';
import { CSharpDevKitExports } from '../../csharpDevKitExports';
import { SolutionSnapshotId } from '../solutionSnapshot/ISolutionSnapshotProvider';
import TelemetryReporter from '@vscode/extension-telemetry';
import { csharpDevkitExtensionId, getCSharpDevKit } from '../../utils/getCSharpDevKit';
import { randomUUID } from 'crypto';
import { IHostExecutableResolver } from '../../shared/constants/IHostExecutableResolver';
import { RoslynLanguageClient } from './roslynLanguageClient';
import { provideDiagnostics, provideWorkspaceDiagnostics } from '../diagnostics/diagnosticMiddleware';
import { reportProjectConfigurationEvent } from '../../shared/projectConfiguration';
import { getDotnetInfo } from '../../shared/utils/getDotnetInfo';
import { DotnetInfo } from '../../shared/utils/dotnetInfo';
import { RoslynLanguageServerEvents, ServerState } from './languageServerEvents';
import { registerShowToastNotification } from '../handlers/showToastNotification';
import { registerOnAutoInsert } from '../autoInsert/onAutoInsert';
import { commonOptions, languageServerOptions, omnisharpOptions } from '../../shared/options';
import { VSTextDocumentIdentifier } from './roslynProtocol';
import { IDisposable } from '../../disposable';
import { BuildDiagnosticsService } from '../diagnostics/buildDiagnosticsService';
import { getComponentPaths } from '../extensions/builtInComponents';
import { OnAutoInsertFeature } from '../autoInsert/onAutoInsertFeature';
import { ProjectContextService } from '../projectContext/projectContextService';
import { CommandOption, showInformationMessage } from '../../shared/observers/utils/showMessage';
import { TelemetryEventNames } from '../../shared/telemetryEventNames';
import { getProfilingEnvVars } from '../logging/profiling';
import { getServerPath } from '../activate';
import { UriConverter } from '../utils/uriConverter';
import { ProjectContextFeature } from '../projectContext/projectContextFeature';
import { isSolutionFileOnDisk } from '../../solutionFileWorkspaceHandler';

// Flag indicating if C# Devkit was installed the last time we activated.
// Used to determine if we need to restart the server on extension changes.
let _wasActivatedWithCSharpDevkit: boolean | undefined;

export class RoslynLanguageServer {
    /**
     * The timeout for stopping the language server (in ms).
     */
    private static _stopTimeout = 10000;

    /**
     * The process Id of the currently running language server process.
     */
    private static _processId: number | undefined;

    /**
     * The solution file previously opened; we hold onto this so we can send this back over if the server were to be relaunched for any reason, like some other configuration
     * change that required the server to restart, or some other catastrophic failure that completely took down the process. In the case that the process is crashing because
     * of trying to load this solution file, we'll rely on VS Code's support to eventually stop relaunching the LSP server entirely.
     */
    private _solutionFile: vscode.Uri | undefined;

    /** The project files previously opened; we hold onto this for the same reason as _solutionFile. */
    private _projectFiles: vscode.Uri[] = new Array<vscode.Uri>();

    public readonly _onAutoInsertFeature: OnAutoInsertFeature;
    public readonly _projectContextFeature: ProjectContextFeature;

    public readonly _buildDiagnosticService: BuildDiagnosticsService;
    public readonly _projectContextService: ProjectContextService;

    private _state: ServerState = ServerState.Stopped;

    constructor(
        private _languageClient: RoslynLanguageClient,
        private _platformInfo: PlatformInformation,
        private _context: vscode.ExtensionContext,
        private _telemetryReporter: TelemetryReporter,
        private _languageServerEvents: RoslynLanguageServerEvents,
        private _channel: vscode.LogOutputChannel,
        private _traceChannel: vscode.LogOutputChannel
    ) {
        this.registerOutputChannelsChangeHandlers();
        this.registerSendOpenSolution();
        this.registerProjectInitialization();
        this.registerServerStateChanged();
        this.registerServerStateTracking();
        this.registerReportProjectConfiguration();
        this.registerExtensionsChanged();
        this.registerTelemetryChanged();

        const diagnosticsReportedByBuild = vscode.languages.createDiagnosticCollection('csharp-build');
        this._buildDiagnosticService = new BuildDiagnosticsService(diagnosticsReportedByBuild);
        this.registerDocumentOpenForDiagnostics();

        this._projectContextService = new ProjectContextService(this, this._languageClient, this._languageServerEvents);

        this.registerDebuggerAttach();

        registerShowToastNotification(this._languageClient);

        registerOnAutoInsert(this, this._languageClient);

        this._onAutoInsertFeature = new OnAutoInsertFeature(this._languageClient);
        this._projectContextFeature = new ProjectContextFeature(this._languageClient);
    }

    public get state(): ServerState {
        return this._state;
    }

    public static get processId(): number | undefined {
        return RoslynLanguageServer._processId;
    }

    private registerOutputChannelsChangeHandlers() {
        this._languageClient.onDidChangeState(async (state) => {
            if (state.newState === State.Running) {
                await this.updateOutputChannelLogLevel();
                await this.updateTraceChannelLogLevel();
            }
        });
        // Register for changes to the log level.
        this._channel.onDidChangeLogLevel(async () => {
            await this.updateOutputChannelLogLevel();
        });
        this._traceChannel.onDidChangeLogLevel(async () => {
            // The LSP client also responds to didChangeLogLevel and sets its own logic; we want to override that so do a small delay
            setTimeout(async () => {
                await this.updateTraceChannelLogLevel();
            }, 1);
        });
    }

    private async updateOutputChannelLogLevel(): Promise<void> {
        if (this._languageClient.state === State.Running) {
            // Update the server's log level.
            await this.sendNotification('roslyn/updateLogLevel', {
                logLevel: RoslynLanguageServer.GetServerLogLevel(this._channel.logLevel),
            });
        }
    }

    private async updateTraceChannelLogLevel(): Promise<void> {
        if (this._languageClient.state === State.Running) {
            await this._languageClient.setTrace(
                // If the logLevel is set to trace, we want to have verbose tracing. All tracing from the LSP client is done at 'trace' level,
                // so we can't show tracing at any other output window levels, since it just gets filtered away.
                this._traceChannel.logLevel == vscode.LogLevel.Trace ? Trace.Verbose : Trace.Off
            );
        }
    }

    /**
     * Sets both the output channel and trace channel log levels to Trace for capturing logs.
     * Returns a function that can be called to restore the original log levels.
     */
    public async setLogLevelsForCapture(): Promise<() => Promise<void>> {
        if (this._languageClient.state !== State.Running) {
            // If the server isn't running, return a no-op restore function
            return async () => {};
        }

        // Set server log level to Trace
        await this.sendNotification('roslyn/updateLogLevel', {
            logLevel: 'Trace',
        });

        // Enable verbose tracing on the LSP client
        await this._languageClient.setTrace(Trace.Verbose);

        // Return a function to restore the original log levels
        return async () => {
            await this.updateOutputChannelLogLevel();
            await this.updateTraceChannelLogLevel();
        };
    }

    private registerServerStateChanged() {
        this._languageClient.onDidChangeState(async (state) => {
            if (state.newState === State.Running) {
                RoslynLanguageServer._processId = this._languageClient.initializeResult?._roslyn_processId;
                this._languageServerEvents.onServerStateChangeEmitter.fire({
                    state: ServerState.Started,
                    workspaceLabel: this.workspaceDisplayName(),
                });
                this._telemetryReporter.sendTelemetryEvent(TelemetryEventNames.ClientServerReady);
            } else if (state.newState === State.Stopped) {
                this._languageServerEvents.onServerStateChangeEmitter.fire({
                    state: ServerState.Stopped,
                    workspaceLabel: vscode.l10n.t('Server stopped'),
                });
                RoslynLanguageServer._processId = undefined;
            }
        });
    }

    private registerServerStateTracking() {
        this._languageServerEvents.onServerStateChange((e) => {
            this._state = e.state;
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
            }
        });
    }

    private registerProjectInitialization() {
        this._languageClient.onNotification(RoslynProtocol.ProjectInitializationCompleteNotification.type, () => {
            this._languageServerEvents.onServerStateChangeEmitter.fire({
                state: ServerState.ProjectInitializationComplete,
                workspaceLabel: this.workspaceDisplayName(),
            });
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
        languageServerEvents: RoslynLanguageServerEvents,
        channel: vscode.LogOutputChannel,
        traceChannel: vscode.LogOutputChannel
    ): Promise<RoslynLanguageServer> {
        const devKit = getCSharpDevKit();
        let devKitExports: CSharpDevKitExports | undefined = undefined;
        if (devKit) {
            devKitExports = await devKit.activate();
        }

        const serverOptions = await this.getServerExecutableOptions(
            platformInfo,
            hostExecutableResolver,
            context,
            telemetryReporter,
            additionalExtensionPaths,
            channel,
            devKitExports
        );

        const documentSelector = languageServerOptions.documentSelector;
        let server: RoslynLanguageServer | undefined = undefined;

        // Options to control the language client
        const clientOptions: LanguageClientOptions = {
            // Register the server for plain csharp documents
            documentSelector: documentSelector,
            synchronize: {
                fileEvents: [],
            },
            traceOutputChannel: traceChannel,
            outputChannel: channel,
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
                provideDiagnostics,
                provideWorkspaceDiagnostics,
                async sendRequest(type, param, token, next) {
                    if (server !== undefined && type !== RoslynProtocol.VSGetProjectContextsRequest.type) {
                        RoslynLanguageServer.tryAddProjectContext(param, server);
                    }
                    return next(type, param, token);
                },
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
            clientOptions,
            channel
        );

        client.registerProposedFeatures();

        server = new RoslynLanguageServer(
            client,
            platformInfo,
            context,
            telemetryReporter,
            languageServerEvents,
            channel,
            traceChannel
        );

        client.registerFeature(server._onAutoInsertFeature);
        client.registerFeature(server._projectContextFeature);

        // Start the client. This will also launch the server process.
        await client.start();
        return server;
    }

    private static tryAddProjectContext(param: unknown | undefined, server: RoslynLanguageServer): void {
        if (!isObject(param)) {
            return;
        }

        const textDocument = <VSTextDocumentIdentifier | undefined>(param['textDocument'] || param['_vs_textDocument']);
        if (!textDocument) {
            return;
        }

        textDocument._vs_projectContext = server._projectContextService.getDocumentContext(textDocument.uri);
    }

    public async stop(): Promise<void> {
        await this._languageClient.stop(RoslynLanguageServer._stopTimeout);
    }

    public async restart(): Promise<void> {
        await this.stop();
        await this._languageClient.start();
    }

    public workspaceDisplayName(): string {
        if (this._solutionFile !== undefined) {
            return path.basename(this._solutionFile.fsPath);
        } else if (this._projectFiles?.length > 0) {
            return vscode.l10n.t('Workspace projects');
        }

        return '';
    }

    /**
     * Returns whether or not the underlying LSP server is running or not.
     */
    public isRunning(): boolean {
        return this._languageClient.isRunning();
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

        try {
            const response = await this._languageClient.sendRequest(type, params, token);
            return response;
        } catch (e) {
            throw this.convertServerError(type.method, e);
        }
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

        try {
            const response = await this._languageClient.sendRequest(type, token);
            return response;
        } catch (e) {
            throw this.convertServerError(type.method, e);
        }
    }

    public async sendRequestWithProgress<P extends PartialResultParams, R, PR, E, RO>(
        type: ProtocolRequestType<P, R, PR, E, RO>,
        params: P,
        onProgress: (p: PR) => Promise<any>,
        cancellationToken?: vscode.CancellationToken
    ): Promise<R> {
        // Generate a UUID for our partial result token and apply it to our request.
        const partialResultToken: string = randomUUID();
        params.partialResultToken = partialResultToken;
        // Register the callback for progress events.
        const disposable = this._languageClient.onProgress(type, partialResultToken, async (partialResult) => {
            await onProgress(partialResult);
        });

        try {
            const response = await this._languageClient.sendRequest(type, params, cancellationToken);
            return response;
        } catch (e) {
            throw this.convertServerError(type.method, e);
        } finally {
            disposable.dispose();
        }
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

    public registerOnRequest<Params, Result, Error>(
        type: RequestType<Params, Result, Error>,
        handler: RequestHandler<Params, Result, Error>
    ) {
        this._languageClient.addDisposable(this._languageClient.onRequest(type, handler));
    }

    public registerOnNotification(method: string, handler: NotificationHandler0) {
        this._languageClient.addDisposable(this._languageClient.onNotification(method, handler));
    }

    public registerOnNotificationWithParams<Params>(
        type: NotificationType<Params>,
        handler: NotificationHandler<Params>
    ) {
        this._languageClient.addDisposable(this._languageClient.onNotification(type, handler));
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
            } else if (this._projectFiles.length > 0) {
                const projectProtocolUris = this._projectFiles.map((uri) =>
                    this._languageClient.clientOptions.uriConverters!.code2Protocol(uri)
                );
                await this._languageClient.sendNotification(RoslynProtocol.OpenProjectNotification.type, {
                    projects: projectProtocolUris,
                });
            } else {
                return;
            }
            this._languageServerEvents.onServerStateChangeEmitter.fire({
                state: ServerState.ProjectInitializationStarted,
                workspaceLabel: this.workspaceDisplayName(),
            });
        }
    }

    public async refreshFeatureProviders(): Promise<void> {
        return this._languageClient.sendNotification(RoslynProtocol.FeatureProvidersRefreshNotification.type, {});
    }

    private convertServerError(request: string, e: any): Error {
        let error: Error;
        if (e instanceof ResponseError && e.code === -32800) {
            // Convert the LSP RequestCancelled error (code -32800) to a CancellationError so we can handle cancellation uniformly.
            error = new vscode.CancellationError();
        } else if (e instanceof Error) {
            error = e;
        } else if (typeof e === 'string') {
            error = new Error(e);
        } else {
            error = new Error(`Unknown error: ${e.toString()}`);
        }

        if (!(error instanceof vscode.CancellationError)) {
            this._channel.error(`Error making ${request} request`, error);
        }
        return error;
    }

    private async openDefaultSolutionOrProjects(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;

        // If Dev Kit isn't installed, then we are responsible for picking the solution to open, assuming the user hasn't explicitly
        // disabled it.
        const defaultSolution = commonOptions.defaultSolution;
        if (!_wasActivatedWithCSharpDevkit && defaultSolution !== 'disable' && this._solutionFile === undefined) {
            // If we are started with an active solution file, open it.
            if (isSolutionFileOnDisk(activeEditor?.document)) {
                await this.openSolution(activeEditor.document.uri);
            } else if (defaultSolution !== '') {
                await this.openSolution(vscode.Uri.file(defaultSolution));
            } else {
                // Auto open if there is just one solution target; if there's more the one we'll just let the user pick with the picker.
                const solutionUris = await vscode.workspace.findFiles('**/*.sln', '**/node_modules/**', 2);
                if (solutionUris) {
                    if (solutionUris.length === 1) {
                        await this.openSolution(solutionUris[0]);
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
                                await vscode.workspace
                                    .getConfiguration()
                                    .update('dotnet.defaultSolution', 'disable', false);
                            } else {
                                const chosenSolution: vscode.Uri | undefined = await vscode.commands.executeCommand(
                                    'dotnet.openSolution'
                                );
                                if (chosen.action === 'openAndSetDefault' && chosenSolution) {
                                    const relativePath = vscode.workspace.asRelativePath(chosenSolution);
                                    await vscode.workspace
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

                        await this.openProjects(projectUris);
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
                await this._languageClient.sendNotification('serviceBroker/connect', { pipeName: pipeName });
            } else {
                // We'll subscribe if the process later launches, and call this function again to send the pipe name.
                this._context.subscriptions.push(
                    exports.serverProcessLoaded(async () => this.sendOrSubscribeForServiceBrokerConnection())
                );
            }
        }
    }

    public getOnAutoInsertFeature(): OnAutoInsertFeature | undefined {
        return this._onAutoInsertFeature;
    }

    public getProjectContextFeature(): ProjectContextFeature | undefined {
        return this._projectContextFeature;
    }

    private static async getServerExecutableOptions(
        platformInfo: PlatformInformation,
        hostExecutableResolver: IHostExecutableResolver,
        context: vscode.ExtensionContext,
        telemetryReporter: TelemetryReporter,
        additionalExtensionPaths: string[],
        channel: vscode.LogOutputChannel,
        csharpDevKitExtensionExports?: CSharpDevKitExports
    ): Promise<Executable> {
        const serverPath = getServerPath(platformInfo);

        const dotnetInfo = await hostExecutableResolver.getHostExecutableInfo();
        const dotnetExecutablePath = dotnetInfo.path;
        channel.info('Dotnet path: ' + dotnetExecutablePath);

        let args: string[] = [];

        if (commonOptions.waitForDebugger) {
            args.push('--debug');
        }

        // Get the initial log level from the channel.
        // Changes to the channel log level will be picked up by the server after
        // LSP finishes initializing and we're able to pick up the new value.
        const logLevel = this.GetServerLogLevel(channel.logLevel);
        if (logLevel) {
            args.push('--logLevel', logLevel);
        }

        const sourceGeneratorExecution = languageServerOptions.sourceGeneratorExecution;
        if (sourceGeneratorExecution) {
            args.push('--sourceGeneratorExecutionPreference', sourceGeneratorExecution);
        }

        let razorComponentPath = '';
        getComponentPaths('razorExtension', languageServerOptions, channel).forEach((extPath) => {
            additionalExtensionPaths.push(extPath);
            razorComponentPath = path.dirname(extPath);
        });

        args.push('--razorSourceGenerator', path.join(razorComponentPath, 'Microsoft.CodeAnalysis.Razor.Compiler.dll'));

        args.push(
            '--razorDesignTimePath',
            path.join(razorComponentPath, 'Targets', 'Microsoft.NET.Sdk.Razor.DesignTime.targets')
        );

        // Get the brokered service pipe name from C# Dev Kit (if installed).
        if (csharpDevKitExtensionExports) {
            _wasActivatedWithCSharpDevkit = true;

            channel.info('Activating C# + C# Dev Kit...');

            // Set command enablement as soon as we know devkit is available.
            await vscode.commands.executeCommand('setContext', 'dotnet.server.activationContext', 'RoslynDevKit');

            const csharpDevKitArgs = this.getCSharpDevKitExportArgs(additionalExtensionPaths, channel);
            args = args.concat(csharpDevKitArgs);

            await this.setupDevKitEnvironment(
                dotnetInfo.env,
                csharpDevKitExtensionExports,
                additionalExtensionPaths,
                channel
            );
        } else {
            // C# Dev Kit is not installed - continue C#-only activation.
            channel.info('Activating C# standalone...');

            // Set command enablement to use roslyn standalone commands.
            await vscode.commands.executeCommand('setContext', 'dotnet.server.activationContext', 'Roslyn');
            _wasActivatedWithCSharpDevkit = false;

            // Razor has code in Microsoft.CSharp.DesignTime.targets to handle non-Razor-SDK projects, but that doesn't get imported outside
            // of DevKit so we polyfill with a mini-version that Razor provides for that scenario.
            args.push(
                '--csharpDesignTimePath',
                path.join(razorComponentPath, 'Targets', 'Microsoft.CSharpExtension.DesignTime.targets')
            );
        }

        for (const extensionPath of additionalExtensionPaths) {
            args.push('--extension', extensionPath);
        }

        // shouldn't this arg only be set if it's running with CSDevKit?
        args.push('--telemetryLevel', telemetryReporter.telemetryLevel);

        args.push('--extensionLogDirectory', context.logUri.fsPath);

        // The vscode-languageclient library only auto-appends --clientProcessId for NodeModule server options,
        // not for Executable server options. We need to pass it explicitly here.
        args.push(`--clientProcessId=${process.pid.toString()}`);

        let env = dotnetInfo.env;
        if (!languageServerOptions.useServerGC) {
            // The server by default uses serverGC, if the user opts out we need to set the environment variable to disable it.
            env.DOTNET_gcServer = '0';
            channel.debug('ServerGC disabled');
        }

        const profilingEnvVars = getProfilingEnvVars(channel);
        env = { ...env, ...profilingEnvVars };

        channel.trace(`Profiling environment variables: ${JSON.stringify(profilingEnvVars)}`);

        const customEnvVars = languageServerOptions.environmentVariables;
        if (Object.keys(customEnvVars).length > 0) {
            env = { ...env, ...customEnvVars };
            channel.info(`Custom environment variables: ${JSON.stringify(customEnvVars)}`);
        }

        let command: string;
        if (serverPath.endsWith('.dll')) {
            // If we were given a path to a dll, launch that via dotnet.
            args = [serverPath].concat(args);
            command = dotnetExecutablePath;
        } else {
            // Otherwise assume we were given a path to an executable.
            command = serverPath;
        }

        channel.debug(`Starting server at ${command}`);
        channel.debug(`Server arguments ${args.join(' ')}`);

        return {
            command: command,
            args: args,
            transport: TransportKind.pipe,
            options: {
                detached: true,
                env: env,
            },
        };
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
                if (event.languageId !== 'csharp') {
                    return;
                }
                try {
                    const buildIds = await this.getBuildOnlyDiagnosticIds(CancellationToken.None);
                    await this._buildDiagnosticService._onFileOpened(event, buildIds);
                } catch (e) {
                    if (e instanceof vscode.CancellationError) {
                        // The request was cancelled (not due to us) - this means the server is no longer accepting requests
                        // so there is nothing for us to do here.
                        return;
                    }

                    // Let non-cancellation errors bubble up.
                    throw e;
                }
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

                const title: CommandOption = {
                    title: vscode.l10n.t('Reload C# Extension'),
                    command: 'workbench.action.restartExtensionHost',
                };
                if (csharpDevkitExtension && !_wasActivatedWithCSharpDevkit) {
                    // We previously started without C# Dev Kit and it's now installed.
                    // Offer a prompt to restart extensions in order to use C# Dev Kit.
                    this._channel.info(`Detected new installation of ${csharpDevkitExtensionId}`);
                    const message = `Detected installation of C# Dev Kit. Please reload the C# extension to continue.`;
                    showInformationMessage(vscode, message, title);
                } else {
                    // Any other change to extensions is irrelevant - an uninstall requires the extension host to restart
                    // which will automatically restart this extension too.
                }
            })
        );
    }

    private registerTelemetryChanged() {
        // Subscribe to telemetry events so we can enable/disable as needed
        this._languageClient.addDisposable(
            vscode.env.onDidChangeTelemetryEnabled((_: boolean) => {
                const restart: CommandOption = {
                    title: vscode.l10n.t('Restart Language Server'),
                    command: 'dotnet.restartServer',
                };
                const message = vscode.l10n.t(
                    'Detected change in telemetry settings. These will not take effect until the language server is restarted, would you like to restart?'
                );
                showInformationMessage(vscode, message, restart);
            })
        );
    }

    private static getCSharpDevKitExportArgs(
        additionalExtensionPaths: string[],
        channel: vscode.LogOutputChannel
    ): string[] {
        const args: string[] = [];

        const devKitDepsPath = getComponentPaths('roslynDevKit', languageServerOptions, channel);
        if (devKitDepsPath.length > 1) {
            throw new Error('Expected only one devkit deps path');
        }

        args.push('--devKitDependencyPath', devKitDepsPath[0]);

        args.push('--sessionId', getSessionId());

        // Also include the Xaml Dev Kit extensions, if enabled.
        if (languageServerOptions.enableXamlTools) {
            getComponentPaths('xamlTools', languageServerOptions, channel).forEach((path) =>
                additionalExtensionPaths.push(path)
            );
        }

        return args;
    }

    private static async setupDevKitEnvironment(
        env: NodeJS.ProcessEnv,
        csharpDevkitExtensionExports: CSharpDevKitExports,
        additionalExtensionPaths: string[],
        channel: vscode.LogOutputChannel
    ): Promise<void> {
        // setupTelemetryEnvironmentAsync was a later addition to devkit (not in preview 1)
        // so it may not exist in whatever version of devkit the user has installed
        if (csharpDevkitExtensionExports.setupTelemetryEnvironmentAsync) {
            await csharpDevkitExtensionExports.setupTelemetryEnvironmentAsync(env);
        }

        getComponentPaths('roslynCopilot', languageServerOptions, channel).forEach((extPath) => {
            additionalExtensionPaths.push(extPath);
        });
    }

    /**
     * Returns the C# Microsoft.Extensions.Logging.LogLevel enum string value
     * corresponding to the given vscode.LogLevel.
     */
    private static GetServerLogLevel(logLevel: vscode.LogLevel): string {
        switch (logLevel) {
            case vscode.LogLevel.Trace:
                return 'Trace';
            case vscode.LogLevel.Debug:
                return 'Debug';
            case vscode.LogLevel.Info:
                return 'Information';
            case vscode.LogLevel.Warning:
                return 'Warning';
            case vscode.LogLevel.Error:
                return 'Error';
            case vscode.LogLevel.Off:
                return 'None';
            default:
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

export function isObject(value: any): value is { [key: string]: any } {
    return value !== null && typeof value === 'object';
}

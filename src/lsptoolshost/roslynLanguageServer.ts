/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as uuid from 'uuid';
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
} from 'vscode-languageclient/node';
import { PlatformInformation } from '../shared/platform';
import { readConfigurations } from './configurationMiddleware';
import OptionProvider from '../shared/observers/optionProvider';
import { DynamicFileInfoHandler } from '../razor/src/dynamicFile/dynamicFileInfoHandler';
import ShowInformationMessage from '../shared/observers/utils/showInformationMessage';
import * as RoslynProtocol from './roslynProtocol';
import { CSharpDevKitExports } from '../csharpDevKitExports';
import { SolutionSnapshotId } from './services/ISolutionSnapshotProvider';
import { Options } from '../shared/options';
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

    constructor(
        private _languageClient: RoslynLanguageClient,
        private _platformInfo: PlatformInformation,
        private _optionProvider: OptionProvider,
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
                const languageClientTraceLevel = RoslynLanguageServer.GetTraceLevel(
                    this._optionProvider.GetLatestOptions().languageServerOptions.logLevel
                );

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
        optionProvider: OptionProvider,
        context: vscode.ExtensionContext,
        telemetryReporter: TelemetryReporter,
        additionalExtensionPaths: string[],
        languageServerEvents: RoslynLanguageServerEvents
    ): Promise<RoslynLanguageServer> {
        const options = optionProvider.GetLatestOptions();

        const serverOptions: ServerOptions = async () => {
            return await this.startServer(
                platformInfo,
                hostExecutableResolver,
                optionProvider,
                context,
                telemetryReporter,
                additionalExtensionPaths
            );
        };

        const documentSelector = options.languageServerOptions.documentSelector;

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

        const server = new RoslynLanguageServer(
            client,
            platformInfo,
            optionProvider,
            context,
            telemetryReporter,
            languageServerEvents
        );

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
        const options = this._optionProvider.GetLatestOptions();

        // If Dev Kit isn't installed, then we are responsible for picking the solution to open, assuming the user hasn't explicitly
        // disabled it.
        if (
            !_wasActivatedWithCSharpDevkit &&
            options.commonOptions.defaultSolution !== 'disable' &&
            this._solutionFile === undefined
        ) {
            if (options.commonOptions.defaultSolution !== '') {
                this.openSolution(vscode.Uri.file(options.commonOptions.defaultSolution));
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
                            options.omnisharpOptions.maxProjectResults
                        );

                        this.openProjects(projectUris);
                    }
                }
            }
        }
    }

    private async sendOrSubscribeForServiceBrokerConnection(): Promise<void> {
        const csharpDevKitExtension = vscode.extensions.getExtension<CSharpDevKitExports>(csharpDevkitExtensionId);
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
        optionProvider: OptionProvider,
        context: vscode.ExtensionContext,
        telemetryReporter: TelemetryReporter,
        additionalExtensionPaths: string[]
    ): Promise<cp.ChildProcess> {
        const options = optionProvider.GetLatestOptions();
        const serverPath = getServerPath(options, platformInfo);

        const dotnetInfo = await hostExecutableResolver.getHostExecutableInfo(options);
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

        let args: string[] = [];

        if (options.commonOptions.waitForDebugger) {
            args.push('--debug');
        }

        const logLevel = options.languageServerOptions.logLevel;
        if (logLevel) {
            args.push('--logLevel', logLevel);
        }

        for (const extensionPath of additionalExtensionPaths) {
            args.push('--extension', extensionPath);
        }

        // Get the brokered service pipe name from C# Dev Kit (if installed).
        // We explicitly call this in the LSP server start action instead of awaiting it
        // in our activation because C# Dev Kit depends on C# activation completing.
        const csharpDevkitExtension = vscode.extensions.getExtension<CSharpDevKitExports>(csharpDevkitExtensionId);
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

            const csharpDevkitArgs = await this.getCSharpDevkitExportArgs(csharpDevkitExtension, options);
            args = args.concat(csharpDevkitArgs);

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

        return childProcess;
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

    private registerDebuggerAttach() {
        this._languageClient.onRequest<RoslynProtocol.DebugAttachParams, RoslynProtocol.DebugAttachResult, void>(
            RoslynProtocol.DebugAttachRequest.type,
            async (request) => {
                const debugOptions = this._optionProvider.GetLatestOptions().commonOptions.unitTestDebuggingOptions;
                const debugConfiguration: vscode.DebugConfiguration = {
                    ...debugOptions,
                    name: '.NET Core Attach',
                    type: 'coreclr',
                    request: 'attach',
                    processId: request.processId,
                };

                const result = await vscode.debug.startDebugging(undefined, debugConfiguration, undefined);
                return {
                    didAttach: result,
                };
            }
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

    private static async getCSharpDevkitExportArgs(
        csharpDevkitExtension: vscode.Extension<CSharpDevKitExports>,
        options: Options
    ): Promise<string[]> {
        const exports: CSharpDevKitExports = await csharpDevkitExtension.activate();

        const extensionPaths = options.languageServerOptions.extensionsPaths || [
            this.getLanguageServicesDevKitComponentPath(exports),
        ];

        const args: string[] = [];

        args.push('--sharedDependencies');
        args.push(exports.components['@microsoft/visualstudio-server-shared']);

        for (const extensionPath of extensionPaths) {
            args.push('--extension');
            args.push(extensionPath);
        }

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

    private static getLanguageServicesDevKitComponentPath(csharpDevKitExports: CSharpDevKitExports): string {
        return path.join(
            csharpDevKitExports.components['@microsoft/visualstudio-languageservices-devkit'],
            'Microsoft.VisualStudio.LanguageServices.DevKit.dll'
        );
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
    optionProvider: OptionProvider,
    optionObservable: Observable<Options>,
    outputChannel: vscode.OutputChannel,
    dotnetTestChannel: vscode.OutputChannel,
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
        optionProvider,
        context,
        reporter,
        additionalExtensionPaths,
        languageServerEvents
    );

    // Register any commands that need to be handled by the extension.
    registerCommands(context, languageServer, optionProvider, hostExecutableResolver, _channel);

    registerRazorCommands(context, languageServer);

    registerUnitTestingCommands(context, languageServer, dotnetTestChannel);

    // Register any needed debugger components that need to communicate with the language server.
    registerDebugger(context, languageServer, languageServerEvents, platformInfo, optionProvider, _channel);

    registerOnAutoInsert(optionProvider, languageServer);

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

function getServerPath(options: Options, platformInfo: PlatformInformation) {
    let serverPath = options.commonOptions.serverPath;
    if (!serverPath) {
        // Option not set, use the path from the extension.
        serverPath = getInstalledServerPath(platformInfo);
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

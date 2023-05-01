/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { registerCommands } from './commands';
import { registerDebugger } from './debugger';
import { UriConverter } from './uriConverter';

import {
    DidChangeTextDocumentNotification,
    DidCloseTextDocumentNotification,
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    DidCloseTextDocumentParams,
    DidChangeTextDocumentParams,
    DocumentDiagnosticParams,
    State,
    Trace,
    StateChangeEvent,
    RequestType,
    RequestType0,
    FormattingOptions,
    TextDocumentIdentifier,
    DocumentDiagnosticRequest,
    DocumentDiagnosticReport,
    integer,
    CancellationToken,
    CodeAction,
    CodeActionParams,
    CodeActionRequest,
    CodeActionResolveRequest,
} from 'vscode-languageclient/node';
import { PlatformInformation } from '../shared/platform';
import { DotnetResolver } from '../shared/DotnetResolver';
import { readConfigurations } from './configurationMiddleware';
import OptionProvider from '../shared/observers/OptionProvider';
import { DynamicFileInfoHandler } from '../razor/src/DynamicFile/DynamicFileInfoHandler';
import ShowInformationMessage from '../shared/observers/utils/ShowInformationMessage';
import EventEmitter = require('events');
import Disposable from '../Disposable';
import { RegisterSolutionSnapshotRequest, OnAutoInsertRequest, RoslynProtocol } from './roslynProtocol';
import { OpenSolutionParams } from './OpenSolutionParams';
import { CSharpDevKitExports } from '../CSharpDevKitExports';
import { ISolutionSnapshotProvider } from './services/ISolutionSnapshotProvider';

let _languageServer: RoslynLanguageServer;
let _channel: vscode.OutputChannel;
let _traceChannel: vscode.OutputChannel;

const csharpDevkitExtensionId = "ms-dotnettools.csdevkit";

export class RoslynLanguageServer {

    // These are commands that are invoked by the Razor extension, and are used to send LSP requests to the Roslyn LSP server
    public static readonly roslynDidOpenCommand: string = 'roslyn.openRazorCSharp';
    public static readonly roslynDidChangeCommand: string = 'roslyn.changeRazorCSharp';
    public static readonly roslynDidCloseCommand: string = 'roslyn.closeRazorCSharp';
    public static readonly roslynPullDiagnosticCommand: string = 'roslyn.pullDiagnosticRazorCSharp';
    public static readonly provideCodeActionsCommand: string = 'roslyn.provideCodeActions';
    public static readonly resolveCodeActionCommand: string = 'roslyn.resolveCodeAction';

    // These are notifications we will get from the LSP server and will forward to the Razor extension.
    private static readonly provideRazorDynamicFileInfoMethodName: string = 'razor/provideDynamicFileInfo';
    private static readonly removeRazorDynamicFileInfoMethodName: string = 'razor/removeDynamicFileInfo';

    /**
     * Event name used to fire events to the _eventBus when the server state changes.
     */
    private static readonly serverStateChangeEvent: string = "serverStateChange";

    /**
     * The timeout for stopping the language server (in ms).
     */
    private static _stopTimeout: number = 10000;
    private _languageClient: LanguageClient | undefined;

    /**
     * Flag indicating if C# Devkit was installed the last time we activated.
     * Used to determine if we need to restart the server on extension changes.
     */
    private _wasActivatedWithCSharpDevkit: boolean | undefined;

    /**
     * Event emitter that fires events when state related to the server changes.
     * For example when the server starts or stops.
     *
     * Consumers can register to listen for these events if they need to.
     */
    private _eventBus = new EventEmitter();

    /**
     * The solution file previously opened; we hold onto this so we can send this back over if the server were to be relaunched for any reason, like some other configuration
     * change that required the server to restart, or some other catastrophic failure that completely took down the process. In the case that the process is crashing because
     * of trying to load this solution file, we'll rely on VS Code's support to eventually stop relaunching the LSP server entirely.
     */
    private _solutionFile: vscode.Uri | undefined;

    constructor(
        private platformInfo: PlatformInformation,
        private optionProvider: OptionProvider,
        private context: vscode.ExtensionContext,
    ) {
        // subscribe to extension change events so that we can get notified if C# Dev Kit is added/removed later.
        this.context.subscriptions.push(vscode.extensions.onDidChange(async () => {
            let csharpDevkitExtension = vscode.extensions.getExtension(csharpDevkitExtensionId);

            if (this._wasActivatedWithCSharpDevkit === undefined) {
                // Haven't activated yet.
                return;
            }

            const title = 'Restart Language Server';
            const command = 'dotnet.restartServer';
            if (csharpDevkitExtension && !this._wasActivatedWithCSharpDevkit) {
                // We previously started without C# Dev Kit and its now installed.
                // Offer a prompt to restart the server to use C# Dev Kit.
                _channel.appendLine(`Detected new installation of ${csharpDevkitExtensionId}`);
                let message = `Detected installation of ${csharpDevkitExtensionId}. Would you like to relaunch the language server for added features?`;
                ShowInformationMessage(vscode, message, { title, command });
            } else {
                // Any other change to extensions is irrelevant - an uninstall requires a reload of the window
                // which will automatically restart this extension too.
            }
        }));
    }

    /**
     * Resolves server options and starts the dotnet language server process.
     */
    public async start(): Promise<void> {
        const dotnetResolver = new DotnetResolver(this.platformInfo);

        let options = this.optionProvider.GetLatestOptions();
        let resolvedDotnet = await dotnetResolver.getHostExecutableInfo(options);
        _channel.appendLine("Dotnet version: " + resolvedDotnet.version);

        let logLevel = options.languageServerOptions.logLevel;
        const languageClientTraceLevel = this.GetTraceLevel(logLevel);

        let serverOptions: ServerOptions = async () => {
            return await this.startServer(logLevel);
        };

        let documentSelector = options.languageServerOptions.documentSelector;

        // Options to control the language client
        let clientOptions: LanguageClientOptions = {
            // Register the server for plain csharp documents
            documentSelector: documentSelector,
            synchronize: {
                // Notify the server about file changes to '.clientrc files contain in the workspace
                fileEvents: vscode.workspace.createFileSystemWatcher('**/*.*')
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
                }
            }
        };

        // Create the language client and start the client.
        let client = new LanguageClient(
            'microsoft-codeanalysis-languageserver',
            'Microsoft.CodeAnalysis.LanguageServer',
            serverOptions,
            clientOptions
        );

        client.registerProposedFeatures();

        this._languageClient = client;

        // Set the language client trace level based on the log level option.
        // setTrace only works after the client is already running.
        // We don't use registerOnStateChange here because we need to access the actual _languageClient instance.
        this._languageClient.onDidChangeState(async (state) => {
            if (state.newState === State.Running) {
                await this._languageClient!.setTrace(languageClientTraceLevel);
                await this.sendOpenSolutionNotification();
            }
        });

        // Register an event that fires on state change so consumers of the RoslynLanguageServer type
        // can also act on state changes.
        this._languageClient.onDidChangeState(async (state) => {
            this._eventBus.emit(RoslynLanguageServer.serverStateChangeEvent, state);
        });

        // Start the client. This will also launch the server
        this._languageClient.start();

        // Register Razor dynamic file info handling
        this.registerRazor(this._languageClient);
    }

    public async stop(): Promise<void> {
        await this._languageClient?.stop(RoslynLanguageServer._stopTimeout);
        this._languageClient?.dispose(RoslynLanguageServer._stopTimeout);
        this._languageClient = undefined;
    }

    /**
     * Restarts the language server.
     * Note that since some options affect how the language server is initialized, we must
     * re-create the LanguageClient instance instead of just stopping/starting it.
     */
    public async restart(): Promise<void> {
        await this.stop();
        await this.start();
    }

    /**
     * Allows consumers of this server to register for state change events.
     * These state change events will be registered each time the underlying _languageClient instance is created.
     */
    public registerOnStateChange(listener: (stateChange: StateChangeEvent) => Promise<any>): Disposable {
        this._eventBus.addListener(RoslynLanguageServer.serverStateChangeEvent, listener);
        return new Disposable(() => this._eventBus.removeListener(RoslynLanguageServer.serverStateChangeEvent, listener));
    }

    /**
     * Returns whether or not the underlying LSP server is running or not.
     */
    public isRunning(): boolean {
        return this._languageClient?.state === State.Running;
    }

    /**
     * Makes an LSP request to the server with a given type and parameters.
     */
    public async sendRequest<Params, Response, Error>(type: RequestType<Params, Response, Error>, params: Params, token: vscode.CancellationToken): Promise<Response> {
        if (!this.isRunning()) {
            throw new Error('Tried to send request while server is not started.');
        }

        let response = await this._languageClient!.sendRequest(type, params, token);
        return response;
    }

    /**
     * Makes an LSP request to the server with a given type and no parameters
     */
    public async sendRequest0<Response, Error>(type: RequestType0<Response, Error>, token: vscode.CancellationToken): Promise<Response> {
        if (!this.isRunning()) {
            throw new Error('Tried to send request while server is not started.');
        }

        let response = await this._languageClient!.sendRequest(type, token);
        return response;
    }

    public async registerSolutionSnapshot(token: vscode.CancellationToken) : Promise<integer> {
        let response = await _languageServer.sendRequest0(RegisterSolutionSnapshotRequest.type, token);
        if (response)
        {
            return response.snapshot_id;
        }

        throw new Error('Unable to retrieve current solution.');
    }

    public async openSolution(solutionFile: vscode.Uri): Promise<void> {
        this._solutionFile = solutionFile;
        await this.sendOpenSolutionNotification();
    }

    private async sendOpenSolutionNotification() {
        if (this._solutionFile !== undefined && this._languageClient !== undefined && this._languageClient.isRunning()) {
            let protocolUri = this._languageClient.clientOptions.uriConverters!.code2Protocol(this._solutionFile);
            await this._languageClient.sendNotification("solution/open", new OpenSolutionParams(protocolUri));
        }
    }

    public getServerCapabilities() : any {
        if (!this._languageClient) {
            throw new Error('Tried to send request while server is not started.');
        }

        let capabilities: any = this._languageClient.initializeResult?.capabilities;
        return capabilities;
    }

    private async startServer(logLevel: string | undefined): Promise<cp.ChildProcess> {
        let clientRoot = __dirname;

        let serverPath = this.optionProvider.GetLatestOptions().commonOptions.serverPath;
        if (!serverPath) {
            // Option not set, use the path from the extension.
            serverPath = path.join(clientRoot, '..', '.roslyn', this.getServerFileName());
        }

        if (!fs.existsSync(serverPath)) {
            throw new Error(`Cannot find language server in path '${serverPath}''`);
        }

        let args: string[] = [ ];

        let options = this.optionProvider.GetLatestOptions();
        if (options.commonOptions.waitForDebugger) {
            args.push("--debug");
        }

        if (logLevel) {
            args.push("--logLevel", logLevel);
        }

        // Get the brokered service pipe name from C# Dev Kit (if installed).
        // We explicitly call this in the LSP server start action instead of awaiting it
        // in our activation because C# Dev Kit depends on C# activation completing.
        const csharpDevkitExtension = vscode.extensions.getExtension<CSharpDevKitExports>(csharpDevkitExtensionId);
        if (csharpDevkitExtension) {
            _channel.appendLine("Activating C# + C# Dev Kit...");
            this._wasActivatedWithCSharpDevkit = true;
            const csharpDevkitArgs = await this.getCSharpDevkitExportArgs(csharpDevkitExtension);
            args = args.concat(csharpDevkitArgs);
        } else {
            // C# Dev Kit is not installed - continue C#-only activation.
            _channel.appendLine("Activating C# standalone...");
            vscode.commands.executeCommand("setContext", "dotnet.server.activatedStandalone", true);
            this._wasActivatedWithCSharpDevkit = false;
        }

        if (logLevel && [Trace.Messages, Trace.Verbose].includes(this.GetTraceLevel(logLevel))) {
            _channel.appendLine(`Starting server at ${serverPath}`);
        }

        let childProcess: cp.ChildProcessWithoutNullStreams;
        if (serverPath.endsWith('.dll')) {
            // If we were given a path to a dll, launch that via dotnet.
            const argsWithPath = [ serverPath ].concat(args);
            childProcess = cp.spawn('dotnet', argsWithPath);
        } else {
            // Otherwise assume we were given a path to an executable.
            childProcess = cp.spawn(serverPath, args);
        }

        return childProcess;
    }

    private registerRazor(client: LanguageClient) {
        // When the Roslyn language server sends a request for Razor dynamic file info, we forward that request along to Razor via
        // a command.
        client.onRequest(
            RoslynLanguageServer.provideRazorDynamicFileInfoMethodName,
            async request => vscode.commands.executeCommand(DynamicFileInfoHandler.provideDynamicFileInfoCommand, request));
        client.onNotification(
            RoslynLanguageServer.removeRazorDynamicFileInfoMethodName,
            async notification => vscode.commands.executeCommand(DynamicFileInfoHandler.removeDynamicFileInfoCommand, notification));

        // Razor will call into us (via command) for generated file didChange/didClose notifications. We'll then forward these
        // notifications along to Roslyn. didOpen notifications are handled separately via the vscode.openTextDocument method.
        vscode.commands.registerCommand(RoslynLanguageServer.roslynDidChangeCommand, (notification: DidChangeTextDocumentParams) => {
            client.sendNotification(DidChangeTextDocumentNotification.method, notification);
        });
        vscode.commands.registerCommand(RoslynLanguageServer.roslynDidCloseCommand, (notification: DidCloseTextDocumentParams) => {
            client.sendNotification(DidCloseTextDocumentNotification.method, notification);
        });
        vscode.commands.registerCommand(RoslynLanguageServer.roslynPullDiagnosticCommand, async (request: DocumentDiagnosticParams) => {
            let diagnosticRequestType = new RequestType<DocumentDiagnosticParams, DocumentDiagnosticReport, any>(DocumentDiagnosticRequest.method);
            return await this.sendRequest(diagnosticRequestType, request, CancellationToken.None);
        });

        // The VS Code API for code actions (and the vscode.CodeAction type) doesn't support everything that LSP supports,
        // namely the data property, which Razor needs to identify which code actions are on their allow list, so we need
        // to expose a command for them to directly invoke our code actions LSP endpoints, rather than use built-in commands.
        vscode.commands.registerCommand(RoslynLanguageServer.provideCodeActionsCommand, async (request: CodeActionParams) => {
            return await this.sendRequest(CodeActionRequest.type, request, CancellationToken.None);
        });
        vscode.commands.registerCommand(RoslynLanguageServer.resolveCodeActionCommand, async (request: CodeAction) => {
            return await this.sendRequest(CodeActionResolveRequest.type, request, CancellationToken.None);
        });
    }

    private getServerFileName() {
        const serverFileName = 'Microsoft.CodeAnalysis.LanguageServer';
        let extension = '';
        if (this.platformInfo.isWindows()) {
            extension = '.exe';
        }

        if (this.platformInfo.isMacOS()) {
            // MacOS executables must be signed with codesign.  Currently all Roslyn server executables are built on windows
            // and therefore dotnet publish does not automatically sign them.
            // Tracking bug - https://devdiv.visualstudio.com/DevDiv/_workitems/edit/1767519/
            extension = '.dll';
        }

        return `${serverFileName}${extension}`;
    }

    private async getCSharpDevkitExportArgs(csharpDevkitExtension: vscode.Extension<CSharpDevKitExports>) : Promise<string[]> {
        const exports = await csharpDevkitExtension.activate();

        const brokeredServicePipeName = await exports.getBrokeredServiceServerPipeName();
        const starredCompletionComponentPath = this.getStarredCompletionComponentPath(exports);

        let csharpDevkitArgs: string[] = [ ];
        csharpDevkitArgs.push("--brokeredServicePipeName", brokeredServicePipeName);
        csharpDevkitArgs.push("--starredCompletionComponentPath", starredCompletionComponentPath);
        return csharpDevkitArgs;
    }

    private getStarredCompletionComponentPath(csharpDevkitExports: CSharpDevKitExports): string {
        return csharpDevkitExports.components["@vsintellicode/starred-suggestions-csharp"];
    }

    private GetTraceLevel(logLevel: string): Trace {
        switch (logLevel) {
            case "Trace":
                return Trace.Verbose;
            case "Debug":
                return Trace.Messages;
            case "Information":
                return Trace.Off;
            case "Warning":
                return Trace.Off;
            case "Error":
                return Trace.Off;
            case "Critical":
                return Trace.Off;
            case "None":
                return Trace.Off;
            default:
                _channel.appendLine(`Invalid log level ${logLevel}, server will not start. Please set the 'dotnet.server.trace' configuration to a valid value`);
                throw new Error(`Invalid log level ${logLevel}`);
        }
    }
}

/**
 * Brokered service implementation.
 */
export class SolutionSnapshotProvider implements ISolutionSnapshotProvider {
    public async registerSolutionSnapshot(token: vscode.CancellationToken): Promise<integer> {
        return _languageServer.registerSolutionSnapshot(token);
    }
}

export async function activateRoslynLanguageServer(context: vscode.ExtensionContext, platformInfo: PlatformInformation, optionProvider: OptionProvider, outputChannel: vscode.OutputChannel) {

    // Create a channel for outputting general logs from the language server.
    _channel = outputChannel;
    // Create a separate channel for outputting trace logs - these are incredibly verbose and make other logs very difficult to see.
    _traceChannel = vscode.window.createOutputChannel("C# LSP Trace Logs");

    _languageServer = new RoslynLanguageServer(platformInfo, optionProvider, context);

    // Register any commands that need to be handled by the extension.
    registerCommands(context, _languageServer);

    // Register any needed debugger components that need to communicate with the language server.
    registerDebugger(context, _languageServer, platformInfo, optionProvider, _channel);

    let options = optionProvider.GetLatestOptions();
    let source = new vscode.CancellationTokenSource();
    vscode.workspace.onDidChangeTextDocument(async e => {
        if (!options.languageServerOptions.documentSelector.includes(e.document.languageId))
        {
            return;
        }

        if (e.contentChanges.length > 1 || e.contentChanges.length === 0) {
            return;
        }

        const change = e.contentChanges[0];

        if (!change.range.isEmpty) {
            return;
        }

        const capabilities = await _languageServer.getServerCapabilities();

        if (capabilities._vs_onAutoInsertProvider) {
            if (!capabilities._vs_onAutoInsertProvider._vs_triggerCharacters.includes(change.text)) {
                return;
            }

            source.cancel();
            source = new vscode.CancellationTokenSource();
            await applyAutoInsertEdit(e, source.token);
        }
    });

    // Start the language server.
    await _languageServer.start();
}

async function applyAutoInsertEdit(e: vscode.TextDocumentChangeEvent, token: vscode.CancellationToken) {
    const change = e.contentChanges[0];

    // Need to add 1 since the server expects the position to be where the caret is after the last token has been inserted.
    const position = new vscode.Position(change.range.start.line, change.range.start.character + 1);
    const uri = UriConverter.serialize(e.document.uri);
    const textDocument = TextDocumentIdentifier.create(uri);
    const formattingOptions = getFormattingOptions();
    const request: RoslynProtocol.OnAutoInsertParams = { _vs_textDocument: textDocument, _vs_position: position, _vs_ch: change.text, _vs_options: formattingOptions };
    let response = await _languageServer.sendRequest(OnAutoInsertRequest.type, request, token);
    if (response)
    {
        const textEdit = response._vs_textEdit;
        const startPosition = new vscode.Position(textEdit.range.start.line, textEdit.range.start.character);
        const endPosition = new vscode.Position(textEdit.range.end.line, textEdit.range.end.character);
        const docComment = new vscode.SnippetString(textEdit.newText);
        const code: any = vscode;
        const textEdits = [new code.SnippetTextEdit(new vscode.Range(startPosition, endPosition), docComment)];
        let edit = new vscode.WorkspaceEdit();
        edit.set(e.document.uri, textEdits);

        const applied = vscode.workspace.applyEdit(edit);
        if (!applied) {
            throw new Error("Tried to insert a comment but an error occurred.");
        }
    }
}

function getFormattingOptions() : FormattingOptions {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const tabSize = editorConfig.get<number>('tabSize') ?? 4;
    const insertSpaces = editorConfig.get<boolean>('insertSpaces') ?? true;
    return FormattingOptions.create(tabSize, insertSpaces);
}

// this method is called when your extension is deactivated
export async function deactivate() {
    if (!_languageServer) {
        return undefined;
    }
    return _languageServer.stop();
}


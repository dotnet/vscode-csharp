/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { registerCommands } from './commands';
import { UriConverter } from './uriConverter';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    State,
    Trace,
} from 'vscode-languageclient/node';
import { PlatformInformation } from '../shared/platform';
import { DotnetResolver } from '../shared/DotnetResolver';
import OptionProvider from '../shared/observers/OptionProvider';
import ShowInformationMessage from '../shared/observers/utils/ShowInformationMessage';

let _languageServer: RoslynLanguageServer;
let _channel: vscode.OutputChannel;
let _traceChannel: vscode.OutputChannel;

const greenExtensionId = "ms-dotnettools.visual-studio-green";

export class RoslynLanguageServer {
    /**
     * The timeout for stopping the language server (in ms).
     */
    private static _stopTimeout: number = 10000;
    private _languageClient: LanguageClient | undefined;

    /**
     * Flag indicating if green was installed the last time we activated.
     * Used to determine if we need to restart the server on extension changes.
     */
    private _wasActivatedWithGreen: boolean | undefined;

    constructor(
        private platformInfo: PlatformInformation,
        private optionProvider: OptionProvider,
        private context: vscode.ExtensionContext,
    ) {
        // subscribe to extension change events so that we can get notified if green is added/removed later.
        this.context.subscriptions.push(vscode.extensions.onDidChange(async () => {
            let vsGreenExtension = vscode.extensions.getExtension(greenExtensionId);
            
            if (this._wasActivatedWithGreen === undefined) {
                // Haven't activated yet.
                return;
            }

            const title = 'Restart Language Server';
            const command = 'dotnet.restartServer';
            if (vsGreenExtension && !this._wasActivatedWithGreen) {
                // We previously started without green and its now installed.
                // Offer a prompt to restart the server to use green.
                _channel.appendLine(`Detected new installation of ${greenExtensionId}`);
                let message = `Detected installation of ${greenExtensionId}. Would you like to relaunch the language server for added features?`;
                ShowInformationMessage(vscode, message, { title , command  });
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

        let solutions = await vscode.workspace.findFiles('*.sln', '**/node_modules/**', 1);
        let solutionPath: vscode.Uri | undefined = solutions[0];

        if (solutionPath) {
            _channel.appendLine(`Found solution ${solutionPath}`);
        }
        
        let logLevel = options.languageServerOptions.logLevel;
        const languageClientTraceLevel = Trace.fromString(logLevel);

        let serverOptions: ServerOptions = async () => {
            return await this.startServer(solutionPath, logLevel);
        };

        // Options to control the language client
        let clientOptions: LanguageClientOptions = {
            // Register the server for plain csharp documents
            documentSelector: ['csharp'],
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
        this._languageClient.onDidChangeState(async (state) => {
            if (state.newState === State.Running) {
                await this._languageClient!.setTrace(languageClientTraceLevel);
            }
        });

        // Start the client. This will also launch the server
        this._languageClient.start();
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

    private async startServer(solutionPath: vscode.Uri | undefined, logLevel: string | undefined) : Promise<cp.ChildProcess> {
        let clientRoot = __dirname;

        let serverPath = this.optionProvider.GetLatestOptions().commonOptions.serverPath;
        if (!serverPath) {
            // Option not set, use the path from the extension.
            const fileExtension = this.platformInfo.isWindows() ? '.exe' : '';
            serverPath = path.join(clientRoot, '..', '.roslyn', `Microsoft.CodeAnalysis.LanguageServer${fileExtension}`);
        }

        if (!fs.existsSync(serverPath)) {
            throw new Error(`Cannot find language server in path '${serverPath}''`);
        }

        // Get the brokered service pipe name from green (if installed).
        // We explicitly call this in the LSP server start action instead of awaiting it
        // in our activation because Green depends on Blue activation completing.
        let brokeredServicePipeName = await this.waitForGreenActivationAndGetPipeName();
    
        let args: string[] = [ ];

        if (this.optionProvider.GetLatestOptions().commonOptions.waitForDebugger)
        {
            args.push("--debug");
        }
    
        if (logLevel)
        {
            args.push("--logLevel", logLevel);
        }

        if (brokeredServicePipeName) {
            args.push("--brokeredServicePipeName", brokeredServicePipeName);
        }
        else if (solutionPath) {
            // We only add the solution path if we didn't have a pipe name; if we had a pipe name we won't be opening any solution right away but following
            // what the other process does.
            args.push("--solutionPath", solutionPath.fsPath);
        }

        _channel.appendLine(`Starting server at ${serverPath}`);
    
        let childProcess = cp.spawn(serverPath, args);
        return childProcess;
    }

    private async waitForGreenActivationAndGetPipeName(): Promise<string | undefined> {
        let vsGreenExtension = vscode.extensions.getExtension(greenExtensionId);
        if (!vsGreenExtension) {
            // VS green is not installed - continue blue-only activation.
            _channel.appendLine("Activating Blue standalone...");
            this._wasActivatedWithGreen = false;
            return undefined;
        }
    
        _channel.appendLine("Activating Blue + Green...");
        this._wasActivatedWithGreen = true;
        let vsGreenExports = await vsGreenExtension.activate();
        if (!('getBrokeredServiceServerPipeName' in vsGreenExports)) {
            throw new Error("VS Green is installed but missing expected export getBrokeredServiceServerPipeName");
        }
    
        let brokeredServicePipeName = await vsGreenExports.getBrokeredServiceServerPipeName();
        return brokeredServicePipeName;
    }
}

export async function activateRoslynLanguageServer(context: vscode.ExtensionContext, platformInfo: PlatformInformation, optionsProvider: OptionProvider, outputChannel: vscode.OutputChannel) {

    // Create a channel for outputting general logs from the language server.
    _channel = outputChannel;
    // Create a separate channel for outputting trace logs - these are incredibly verbose and make other logs very difficult to see.
    _traceChannel = vscode.window.createOutputChannel("C# LSP Trace Logs");

    _languageServer = new RoslynLanguageServer(platformInfo, optionsProvider, context);

    // Register any commands that need to be handled by the extension.
    registerCommands(context, _languageServer);

    // Start the language server.
    await _languageServer.start();
}

// this method is called when your extension is deactivated
export async function deactivate() {
    if (!_languageServer) {
        return undefined;
    }
    return _languageServer.stop();
}
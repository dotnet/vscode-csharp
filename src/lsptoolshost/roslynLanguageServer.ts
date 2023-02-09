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
} from 'vscode-languageclient/node';
import { PlatformInformation } from '../shared/platform';
import { DotnetResolver } from '../shared/DotnetResolver';
import OptionProvider from '../shared/observers/OptionProvider';

let _languageServer: RoslynLanguageServer;
let _channel: vscode.OutputChannel;
let _traceChannel: vscode.OutputChannel;

export class RoslynLanguageServer {

    /**
     * The timeout for stopping the language server (in ms).
     */
    private static _stopTimeout: number = 10000;
    private _languageClient: LanguageClient | undefined;

    constructor(
        private platformInfo: PlatformInformation,
        private optionProvider: OptionProvider,
    ) { }

    /**
     * Resolves server options and starts the dotnet language server process.
     */
    public async start(): Promise<void> {
        const dotnetResolver = new DotnetResolver(this.platformInfo);
    
        let options = this.optionProvider.GetLatestOptions();
        let resolvedDotnet = await dotnetResolver.getHostExecutableInfo(options);
        _channel.appendLine("Dotnet version: " + resolvedDotnet.version);

        let solutionPath = await vscode.workspace.findFiles('*.sln', '**/node_modules/**', 1);
        _channel.appendLine(`Found solution ${solutionPath[0]}`);

        let logLevel = options.languageServerOptions.logLevel;

        let serverOptions: ServerOptions = async () => {
            const process = this.startServer(solutionPath[0], logLevel);
            return Promise.resolve<cp.ChildProcess>(process);
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

    private startServer(solutionPath: vscode.Uri, logLevel: string | undefined) : cp.ChildProcess {
        let clientRoot = __dirname;
        
        // This environment variable is used by F5 builds to launch the server from the local build directory.
        let serverDirectory = process.env.ROSLYN_LANGUAGE_SERVER_DIRECTORY
            ? path.join(clientRoot, "..", process.env.ROSLYN_LANGUAGE_SERVER_DIRECTORY)
            : path.join(clientRoot, "..", "artifacts", "languageServer");
    
        let serverPath = path.join(serverDirectory, "Microsoft.CodeAnalysis.LanguageServer.dll");
        if (!fs.existsSync(serverPath)) {
            throw new Error(`Cannot find language server in path '${serverPath}''`);
        }
    
        let args: string[] = [
            serverPath,
            "--solutionPath",
            solutionPath.fsPath,
        ];
    
        if (this.optionProvider.GetLatestOptions().commonOptions.waitForDebugger)
        {
            args.push("--debug");
        }
    
        if (logLevel)
        {
            args.push("--logLevel", logLevel);
        }
    
        let childProcess = cp.spawn('dotnet', args);
        return childProcess;
    }
}

export async function activateRoslynLanguageServer(context: vscode.ExtensionContext, platformInfo: PlatformInformation, optionsProvider: OptionProvider) {

    // Create a channel for outputting general logs from the language server.
    _channel = vscode.window.createOutputChannel("C#");
    // Create a separate channel for outputting trace logs - these are incredibly verbose and make other logs very difficult to see.
    _traceChannel = vscode.window.createOutputChannel("C# LSP Trace Logs");

    _languageServer = new RoslynLanguageServer(platformInfo, optionsProvider);

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
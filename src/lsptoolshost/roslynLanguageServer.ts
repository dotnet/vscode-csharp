/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
} from 'vscode-languageclient/node';

let client: LanguageClient;
let _channel: vscode.OutputChannel;
let _traceChannel: vscode.OutputChannel;

// Some hacky code to get VSCode to start up and connect to the new Roslyn LSP.
// TODO - will be removed and unified with the rest of the omnisharp code in BYO LSP.
// https://github.com/microsoft/vscode-csharp-next/issues/2
export async function activateRoslynLanguageServer(context: vscode.ExtensionContext) {

    // Create a channel for outputting general logs from the language server.
    _channel = vscode.window.createOutputChannel("Microsoft.CodeAnalysis.LanguageServer");
    // Create a separate channel for outputting trace logs - these are incredibly verbose and make other logs very difficult to see.
    _traceChannel = vscode.window.createOutputChannel("Microsoft.CodeAnalysis.LanguageServer.Trace");

    const workDirectory = process.cwd();
    const dotnetVersion = await exec('dotnet --version', workDirectory);
    _channel.appendLine("Dotnet version: " + dotnetVersion);

    let solutionPath = await vscode.workspace.findFiles('*.sln', '**/node_modules/**', 1);
    _channel.appendLine(`Found solution ${solutionPath[0]}`);

    let configuration = vscode.workspace.getConfiguration();
    let logLevel = configuration.get<string>('microsoft-codeanalysis-languageserver.trace.server');

    let serverOptions: ServerOptions = async () => {
        const process = startServer(solutionPath[0], logLevel);
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
    client = new LanguageClient(
        'microsoft-codeanalysis-languageserver',
        'Microsoft.CodeAnalysis.LanguageServer',
        serverOptions,
        clientOptions
    );

    client.registerProposedFeatures();

    // Start the client. This will also launch the server
    client.start();
}

// this method is called when your extension is deactivated
export async function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

export async function exec(command: string, workDirectory: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        cp.exec(command, { cwd: workDirectory, env }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            }
            else if (stderr) {
                reject(new Error(stderr));
            }
            else {
                resolve(stdout);
            }
        });
    });
}

function startServer(solutionPath: vscode.Uri, logLevel: string | undefined) : cp.ChildProcess {
    let clientRoot = __dirname;
    const serverPath = path.join(clientRoot, "..", "artifacts", "Debug", "net7.0", "Microsoft.CodeAnalysis.LanguageServer.dll");

    if (!fs.existsSync(serverPath)) {
        const error = new Error(`Cannot find language server in path '${serverPath}''`);
        throw error;
    }


    let args: string[] = [
        serverPath,
        "--solutionPath",
        solutionPath.fsPath,
    ];

    if (process.env.DEBUG_ROSLYN_LANGUAGE_SERVER)
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

export class UriConverter {
    public static serialize(uri: vscode.Uri): string {
        // Fix issue in System.Uri where file:///c%3A/file.txt is not a valid Windows path
        return uri.toString(true);
    }

    public static deserialize(value: string): vscode.Uri {
        return vscode.Uri.parse(value);
    }
}
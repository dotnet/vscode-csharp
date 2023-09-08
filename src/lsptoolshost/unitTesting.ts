/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as languageClient from 'vscode-languageclient/node';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { RunTestsParams, RunTestsPartialResult, RunTestsRequest, TestProgress } from './roslynProtocol';

export function registerUnitTestingCommands(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    dotnetTestChannel: vscode.OutputChannel
) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'dotnet.test.run',
            async (request): Promise<TestProgress | undefined> => runTests(request, languageServer, dotnetTestChannel)
        )
    );
    context.subscriptions.push(
        // We don't use registerTextEditorCommand because it is required to run synchronously and is not awaitable.
        // See https://github.com/microsoft/vscode/issues/16814 for more info.
        vscode.commands.registerCommand(
            'dotnet.test.runTestsInContext',
            async (): Promise<TestProgress | undefined> => runTestsInContext(false, languageServer, dotnetTestChannel)
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'dotnet.test.debugTestsInContext',
            async (): Promise<TestProgress | undefined> => runTestsInContext(true, languageServer, dotnetTestChannel)
        )
    );
}

async function runTestsInContext(
    debug: boolean,
    languageServer: RoslynLanguageServer,
    dotnetTestChannel: vscode.OutputChannel
): Promise<TestProgress | undefined> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        throw new Error('No active editor');
    }
    const contextRange: languageClient.Range = {
        start: activeEditor.selection.active,
        end: activeEditor.selection.active,
    };
    const textDocument: languageClient.TextDocumentIdentifier = { uri: activeEditor.document.fileName };
    const request: RunTestsParams = { textDocument: textDocument, range: contextRange, attachDebugger: debug };
    return runTests(request, languageServer, dotnetTestChannel);
}

let _testRunInProgress = false;

async function runTests(
    request: RunTestsParams,
    languageServer: RoslynLanguageServer,
    dotnetTestChannel: vscode.OutputChannel
): Promise<TestProgress | undefined> {
    if (_testRunInProgress) {
        vscode.window.showErrorMessage('Test run already in progress');
        return;
    }

    _testRunInProgress = true;

    dotnetTestChannel.show(true);
    let lastProgress: TestProgress | undefined = undefined;
    await vscode.window
        .withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Dotnet Test',
                cancellable: true,
            },
            async (progress, token) => {
                let totalReportedComplete = 0;
                const writeOutput = (output: RunTestsPartialResult) => {
                    if (output.message) {
                        dotnetTestChannel.appendLine(output.message);
                    }

                    if (output.progress) {
                        const totalTests = output.progress.totalTests;
                        const completed =
                            output.progress.testsPassed + output.progress.testsFailed + output.progress.testsSkipped;

                        // VSCode requires us to report the additional amount completed (in x out of 100) from this report compared to what we've previously reported.
                        const reportIncrement = ((completed - totalReportedComplete) / totalTests) * 100;
                        progress.report({ message: output.stage, increment: reportIncrement });
                        totalReportedComplete = completed;
                        lastProgress = output.progress;
                    } else {
                        progress.report({ message: output.stage });
                    }
                };

                progress.report({ message: 'Saving files...' });
                // Ensure all files are saved before we run tests so they accurately reflect what the user has requested to run.
                await vscode.workspace.saveAll(/*includeUntitled*/ false);

                progress.report({ message: 'Requesting server...' });
                const responsePromise = languageServer.sendRequestWithProgress(
                    RunTestsRequest.type,
                    request,
                    async (p) => {
                        writeOutput(p);
                    },
                    token
                );

                await responsePromise.then(
                    (result) => {
                        result.forEach((r) => {
                            writeOutput(r);
                        });
                        return;
                    },
                    (err) => {
                        dotnetTestChannel.appendLine(err);
                        return;
                    }
                );
            }
        )
        .then(
            () => {
                _testRunInProgress = false;
            },
            () => {
                _testRunInProgress = false;
            }
        );

    return lastProgress;
}

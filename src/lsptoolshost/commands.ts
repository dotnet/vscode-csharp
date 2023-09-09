/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { UriConverter } from './uriConverter';
import * as languageClient from 'vscode-languageclient/node';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { createLaunchTargetForSolution } from '../shared/launchTarget';
import reportIssue from '../shared/reportIssue';
import { getDotnetInfo } from '../shared/utils/getDotnetInfo';
import OptionProvider from '../shared/observers/optionProvider';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';

export function registerCommands(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    optionProvider: OptionProvider,
    hostExecutableResolver: IHostExecutableResolver,
    outputChannel: vscode.OutputChannel
) {
    // It is very important to be careful about the types used as parameters for these command callbacks.
    // If the arguments are coming from the server as json, it is NOT appropriate to use type definitions
    // from the normal vscode API (e.g. vscode.Location) as input parameters.
    //
    // This is because at runtime the json objects do not contain the expected prototypes that the vscode types
    // have and will fail 'instanceof' checks that are sprinkled throught the vscode APIs.
    //
    // Instead, we define inputs from the server using the LSP type definitions as those have no prototypes
    // so we don't accidentally pass them directly into vscode APIs.
    context.subscriptions.push(vscode.commands.registerCommand('roslyn.client.peekReferences', peekReferencesCallback));
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'roslyn.client.completionComplexEdit',
            async (uriStr, textEdit, isSnippetString, newOffset) =>
                completionComplexEdit(uriStr, textEdit, isSnippetString, newOffset, outputChannel)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('dotnet.restartServer', async () => restartServer(languageServer))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('dotnet.openSolution', async () => openSolution(languageServer))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.reportIssue', async () =>
            reportIssue(
                vscode,
                context.extension.packageJSON.version,
                getDotnetInfo,
                /*shouldIncludeMonoInfo:*/ false,
                optionProvider.GetLatestOptions(),
                hostExecutableResolver
            )
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.showOutputWindow', async () => outputChannel.show())
    );
}

/**
 * Callback for code lens commands.  Executes a references request via the VSCode command
 * which will call into the LSP server to get the data.  Then calls the VSCode command to display the result.
 * @param uriStr The uri containing the location to find references for.
 * @param serverPosition The position json object to execute the find references request.
 */
async function peekReferencesCallback(uriStr: string, serverPosition: languageClient.Position): Promise<void> {
    const uri = UriConverter.deserialize(uriStr);

    // Convert the json position object into the corresponding vscode position type.
    const vscodeApiPosition = new vscode.Position(serverPosition.line, serverPosition.character);
    const references: vscode.Location[] = await vscode.commands.executeCommand(
        'vscode.executeReferenceProvider',
        uri,
        vscodeApiPosition
    );
    if (references && Array.isArray(references)) {
        // The references could come back after the document has moved to a new state (that may not even contain the position).
        // This is fine - the VSCode API is resilient to that scenario and will not crash.
        vscode.commands.executeCommand('editor.action.showReferences', uri, vscodeApiPosition, references);
    }
}

async function restartServer(languageServer: RoslynLanguageServer): Promise<void> {
    await languageServer.restart();
}

/**
 * Callback after a completion item with complex edit is committed. The change needs to be made outside completion resolve
 * handling
 *
 * IMPORTANT: @see RazorCompletionItemProvider.resolveCompletionItem matches the arguments for this commands
 * so it can remap correctly in razor files. Any updates to this function signature requires updates there as well.
 *
 * @param uriStr The uri containing the location of the document where the completion item was committed in.
 * @param textEdits The additional complex edit for the committed completion item.
 * @param isSnippetString Indicates if the TextEdit contains a snippet string.
 * @param newPosition The offset for new cursor position. -1 if the edit has not specified one.
 */
async function completionComplexEdit(
    uriStr: string,
    textEdit: vscode.TextEdit,
    isSnippetString: boolean,
    newOffset: number,
    outputChannel: vscode.OutputChannel
): Promise<void> {
    let success = false;
    const uri = UriConverter.deserialize(uriStr);
    const editor = vscode.window.visibleTextEditors.find(
        (editor) => editor.document.uri.path === uri.path || editor.document.uri.fsPath === uri.fsPath
    );

    if (editor !== undefined) {
        const newRange = editor.document.validateRange(
            new vscode.Range(
                textEdit.range.start.line,
                textEdit.range.start.character,
                textEdit.range.end.line,
                textEdit.range.end.character
            )
        );

        // HACK:
        // ApplyEdit would fail the first time it's called when an item was committed with text modifying commit char (e.g. space, '(', etc.)
        // so we retry a couple time here as a tempory workaround. We need to either figure our the reason of the failure, and/or try the
        // approach of sending another edit request to server with updated document.
        for (let i = 0; i < 3; i++) {
            if (isSnippetString) {
                editor.selection = new vscode.Selection(newRange.start, newRange.end);
                success = await editor.insertSnippet(new vscode.SnippetString(textEdit.newText));
            } else {
                const edit = new vscode.WorkspaceEdit();
                const newTextEdit = vscode.TextEdit.replace(newRange, textEdit.newText);
                edit.set(editor.document.uri, [newTextEdit]);
                success = await vscode.workspace.applyEdit(edit);

                if (success && newOffset >= 0) {
                    const newPosition = editor.document.positionAt(newOffset);
                    editor.selections = [new vscode.Selection(newPosition, newPosition)];
                }
            }

            if (success) {
                break;
            }
        }
    }

    if (!success) {
        const componentName = '[roslyn.client.completionComplexEdit]';

        if (editor === undefined) {
            outputChannel.show();
            outputChannel.appendLine(`${componentName} Failed to make a complex text edit for completion.`);
            outputChannel.appendLine(
                `${componentName} Can't find visible document with uri.fsPath: '${uri.fsPath}' and uri.path: '${uri.path}'`
            );

            outputChannel.appendLine(`${componentName} URIs of all visible documents:`);
            for (const visibleEditor of vscode.window.visibleTextEditors) {
                outputChannel.appendLine(
                    `${componentName} - uri.fsPath: '${visibleEditor.document.uri.fsPath}' and uri.path: '${visibleEditor.document.uri.path}'`
                );
            }
        } else {
            outputChannel.appendLine(
                `${componentName} ${isSnippetString ? 'TextEditor.insertSnippet' : 'workspace.applyEdit'} failed.`
            );
        }

        throw new Error('Failed to make a complex text edit for completion.');
    }
}

async function openSolution(languageServer: RoslynLanguageServer): Promise<vscode.Uri | undefined> {
    if (!vscode.workspace.workspaceFolders) {
        return undefined;
    }

    const solutionFiles = await vscode.workspace.findFiles('**/*.sln');
    const launchTargets = solutionFiles.map(createLaunchTargetForSolution);
    const launchTarget = await vscode.window.showQuickPick(launchTargets, {
        matchOnDescription: true,
        placeHolder: `Select solution file`,
    });

    if (launchTarget) {
        const uri = vscode.Uri.file(launchTarget.target);
        languageServer.openSolution(uri);
        return uri;
    }
}

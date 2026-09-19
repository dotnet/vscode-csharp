/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Checks if the given document is a solution file (.sln, .slnx, or .slnf)
 */
export function isSolutionFileOnDisk(document: vscode.TextDocument | undefined): document is vscode.TextDocument {
    if (document?.uri.scheme !== 'file') {
        return false;
    }

    const fileName = document.fileName.toLowerCase();
    return fileName.endsWith('.sln') || fileName.endsWith('.slnx') || fileName.endsWith('.slnf');
}

/**
 * Checks if the given URI is within any of the workspace folders
 */
function isWithinWorkspaceFolders(uri: vscode.Uri): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return false;
    }

    const filePath = uri.fsPath;
    return workspaceFolders.some((folder) => filePath.startsWith(folder.uri.fsPath));
}

/**
 * Handles the scenario where a user opens a solution file via `code ./solution.sln`.
 * - If workspaceFolders is empty and the active document is a solution file, opens the parent folder in the current window.
 * - If workspaceFolders exist and the active document changes to a solution file outside those folders,
 *   launches a new window for the parent folder.
 */
export function registerSolutionFileWorkspaceHandler(
    context: vscode.ExtensionContext,
    csharpChannel: vscode.LogOutputChannel
): void {
    // Check on activation if we should open a folder for the current solution file
    void checkAndOpenSolutionFolder(csharpChannel);

    // Listen for active editor changes to handle solutions opened outside current workspace
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                void handleActiveEditorChange(editor, csharpChannel);
            }
        })
    );
}

/**
 * Checks on extension activation if we should open a folder for the active solution file.
 * This handles the case where the user runs `code ./solution.sln` from the command line.
 */
async function checkAndOpenSolutionFolder(csharpChannel: vscode.LogOutputChannel): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }

    await handleActiveEditorChange(activeEditor, csharpChannel);
}

/**
 * Handles changes to the active text editor to detect when a solution file outside
 * the current workspace is opened.
 */
async function handleActiveEditorChange(
    editor: vscode.TextEditor,
    csharpChannel: vscode.LogOutputChannel
): Promise<void> {
    const document = editor.document;
    if (!isSolutionFileOnDisk(document)) {
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    const solutionFolderUri = vscode.Uri.file(path.dirname(document.uri.fsPath));

    // Case 1: No workspace folders - open the solution's parent folder in the current window
    if (!workspaceFolders || workspaceFolders.length === 0) {
        csharpChannel.info(
            `Opening solution file detected with no workspace. Opening folder: ${solutionFolderUri.fsPath}`
        );
        await vscode.commands.executeCommand('vscode.openFolder', solutionFolderUri, {
            forceReuseWindow: true,
        });
    }
    // Case 2: Workspace folders exist but solution is outside of them - open new window
    else if (!isWithinWorkspaceFolders(document.uri)) {
        // Close the current editor to avoid confusion
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        csharpChannel.info(
            `Solution file outside workspace detected. Opening in new window: ${solutionFolderUri.fsPath}`
        );
        // open solution folder and solution file in a new window
        await vscode.commands.executeCommand('vscode.openFolder', solutionFolderUri, {
            forceNewWindow: true,
            filesToOpen: [document.uri],
        });
    }
}

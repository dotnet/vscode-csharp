/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { CSharpExtensionExports } from '../../../src/csharpExtensionExports';
import { existsSync } from 'fs';
import { ServerState } from '../../../src/lsptoolshost/serverStateChange';
import testAssetWorkspace from './testAssets/testAssetWorkspace';

export async function activateCSharpExtension(): Promise<void> {
    // Ensure the dependent extension exists - when launching via F5 launch.json we can't install the extension prior to opening vscode.
    const vscodeDotnetRuntimeExtensionId = 'ms-dotnettools.vscode-dotnet-runtime';
    const dotnetRuntimeExtension =
        vscode.extensions.getExtension<CSharpExtensionExports>(vscodeDotnetRuntimeExtensionId);
    if (!dotnetRuntimeExtension) {
        await vscode.commands.executeCommand('workbench.extensions.installExtension', vscodeDotnetRuntimeExtensionId, {
            donotSync: true,
        });
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }

    const csharpExtension = vscode.extensions.getExtension<CSharpExtensionExports>('ms-dotnettools.csharp');
    if (!csharpExtension) {
        throw new Error('Failed to find installation of ms-dotnettools.csharp');
    }

    // Run a restore manually to make sure the project is up to date since we don't have automatic restore.
    await testAssetWorkspace.restoreLspToolsHostAsync();

    // If the extension is already active, we need to restart it to ensure we start with a clean server state.
    // For example, a previous test may have changed configs, deleted restored packages or made other changes that would put it in an invalid state.
    let shouldRestart = false;
    if (csharpExtension.isActive) {
        shouldRestart = true;
    }

    // Explicitly await the extension activation even if completed so that we capture any errors it threw during activation.
    await csharpExtension.activate();
    await csharpExtension.exports.initializationFinished();
    console.log('ms-dotnettools.csharp activated');
    console.log(`Extension Log Directory: ${csharpExtension.exports.logDirectory}`);

    if (shouldRestart) {
        await restartLanguageServer();
    }
}

export async function openFileInWorkspaceAsync(relativeFilePath: string): Promise<vscode.Uri> {
    const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const filePath = path.join(root, relativeFilePath);
    if (!existsSync(filePath)) {
        throw new Error(`File ${filePath} does not exist`);
    }

    const uri = vscode.Uri.file(filePath);
    await vscode.commands.executeCommand('vscode.open', uri);
    return uri;
}

export async function closeAllEditorsAsync(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
}

/**
 * Reverts any unsaved changes to the active file.
 * Useful to reset state between tests without fully reloading everything.
 */
export async function revertActiveFile(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.files.revert');
}

export async function restartLanguageServer(): Promise<void> {
    const csharpExtension = vscode.extensions.getExtension<CSharpExtensionExports>('ms-dotnettools.csharp');
    // Register to wait for initialization events and restart the server.
    const waitForInitialProjectLoad = new Promise<void>((resolve, _) => {
        csharpExtension!.exports.experimental.languageServerEvents.onServerStateChange(async (e) => {
            if (e.state === ServerState.ProjectInitializationComplete) {
                resolve();
            }
        });
    });
    await vscode.commands.executeCommand('dotnet.restartServer');
    await waitForInitialProjectLoad;
}

export function isRazorWorkspace(workspace: typeof vscode.workspace) {
    return isGivenSln(workspace, 'BasicRazorApp2_1');
}

export function isSlnWithGenerator(workspace: typeof vscode.workspace) {
    return isGivenSln(workspace, 'slnWithGenerator');
}

export async function getCodeLensesAsync(): Promise<vscode.CodeLens[]> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        throw new Error('No active editor');
    }

    // The number of code lens items to resolve.  Set to a high number so we get pretty much everything in the document.
    const resolvedItemCount = 100;

    const codeLenses = <vscode.CodeLens[]>(
        await vscode.commands.executeCommand(
            'vscode.executeCodeLensProvider',
            activeEditor.document.uri,
            resolvedItemCount
        )
    );
    return codeLenses.sort((a, b) => {
        const rangeCompare = a.range.start.compareTo(b.range.start);
        if (rangeCompare !== 0) {
            return rangeCompare;
        }

        return a.command!.title.localeCompare(b.command!.command);
    });
}

export function sortLocations(locations: vscode.Location[]): vscode.Location[] {
    return locations.sort((a, b) => {
        const uriCompare = a.uri.fsPath.localeCompare(b.uri.fsPath);
        if (uriCompare !== 0) {
            return uriCompare;
        }

        return a.range.start.compareTo(b.range.start);
    });
}

export function findRangeOfString(editor: vscode.TextEditor, stringToFind: string): vscode.Range[] {
    const text = editor.document.getText();
    const matches = [...text.matchAll(new RegExp(stringToFind, 'gm'))];
    const ranges = matches.map((match) => {
        const startPos = editor.document.positionAt(match.index!);
        const endPos = editor.document.positionAt(match.index! + stringToFind.length);
        return new vscode.Range(startPos, endPos);
    });
    return ranges;
}

function isGivenSln(workspace: typeof vscode.workspace, expectedProjectFileName: string) {
    const primeWorkspace = workspace.workspaceFolders![0];
    const projectFileName = primeWorkspace.uri.fsPath.split(path.sep).pop();

    return projectFileName === expectedProjectFileName;
}

export async function waitForExpectedResult<T>(
    getValue: () => Promise<T> | T,
    duration: number,
    step: number,
    expression: (input: T) => void
): Promise<void> {
    let value: T;
    let error: any = undefined;

    while (duration > 0) {
        value = await getValue();

        try {
            expression(value);
            return;
        } catch (e) {
            error = e;
            // Wait for a bit and try again.
            await new Promise((r) => setTimeout(r, step));
            duration -= step;
        }
    }

    throw new Error(`Polling did not succeed within the alotted duration: ${error}`);
}

export async function sleep(ms = 0) {
    return new Promise((r) => setTimeout(r, ms));
}

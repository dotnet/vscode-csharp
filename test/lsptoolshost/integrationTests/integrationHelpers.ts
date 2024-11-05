/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as semver from 'semver';
import { CSharpExtensionExports } from '../../../src/csharpExtensionExports';
import { existsSync } from 'fs';
import { ServerState } from '../../../src/lsptoolshost/serverStateChange';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { EOL, platform } from 'os';
import { describe, expect, test } from '@jest/globals';

export async function activateCSharpExtension(): Promise<void> {
    const csharpExtension = vscode.extensions.getExtension<CSharpExtensionExports>('ms-dotnettools.csharp');
    if (!csharpExtension) {
        throw new Error('Failed to find installation of ms-dotnettools.csharp');
    }

    let shouldRestart = false;

    const csDevKitExtension = vscode.extensions.getExtension<CSharpExtensionExports>('ms-dotnettools.csdevkit');
    if (usingDevKit()) {
        if (!csDevKitExtension) {
            throw new Error('Failed to find installation of ms-dotnettools.csdevkit');
        }

        // Ensure C# Dev Kit has a minimum version.
        const version = csDevKitExtension.packageJSON.version;
        const minimumVersion = '1.10.18';
        if (semver.lt(version, minimumVersion)) {
            throw new Error(`C# Dev Kit version ${version} is below required minimum of ${minimumVersion}`);
        }
    } else {
        // Run a restore manually to make sure the project is up to date since we don't have automatic restore.
        await testAssetWorkspace.restoreLspToolsHostAsync();

        // If the extension is already active, we need to restart it to ensure we start with a clean server state.
        // For example, a previous test may have changed configs, deleted restored packages or made other changes that would put it in an invalid state.
        if (csharpExtension.isActive) {
            shouldRestart = true;
        }
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

export function usingDevKit(): boolean {
    return vscode.workspace.getConfiguration().get<boolean>('dotnet.preferCSharpExtension') !== true;
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
    if (usingDevKit()) {
        // Restarting the server will cause us to lose all project information when using C# Dev Kit.
        throw new Error('Cannot restart language server when using the C# Dev Kit');
    }
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
    return isGivenSln(workspace, 'RazorApp');
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

export async function navigate(
    originalPosition: vscode.Position,
    definitionLocations: vscode.Location[],
    expectedFileName: string
): Promise<void> {
    const windowChanged = new Promise<void>((resolve, _) => {
        vscode.window.onDidChangeActiveTextEditor((_e) => {
            if (_e?.document.fileName.includes(expectedFileName)) {
                resolve();
            }
        });
    });

    await vscode.commands.executeCommand(
        'editor.action.goToLocations',
        vscode.window.activeTextEditor!.document.uri,
        originalPosition,
        definitionLocations,
        'goto',
        'Failed to navigate'
    );

    // Navigation happens asynchronously when a different file is opened, so we need to wait for the window to change.
    await windowChanged;

    expect(vscode.window.activeTextEditor?.document.fileName).toContain(expectedFileName);
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

export async function expectText(document: vscode.TextDocument, expectedLines: string[]) {
    const expectedText = expectedLines.join(EOL);
    expect(document.getText()).toBe(expectedText);
}

export const describeIfCSharp = describeIf(!usingDevKit());
export const describeIfDevKit = describeIf(usingDevKit());
export const describeIfNotMacOS = describeIf(!isMacOS());
export const testIfCSharp = testIf(!usingDevKit());
export const testIfDevKit = testIf(usingDevKit());
export const testIfNotMacOS = testIf(!isMacOS());

function describeIf(condition: boolean) {
    return condition ? describe : describe.skip;
}

function testIf(condition: boolean) {
    return condition ? test : test.skip;
}

function isMacOS() {
    const currentPlatform = platform();
    return currentPlatform === 'darwin';
}

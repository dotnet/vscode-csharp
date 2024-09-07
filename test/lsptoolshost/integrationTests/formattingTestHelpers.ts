/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { EOL } from 'os';
import { expect } from '@jest/globals';

export async function formatDocumentAsync(): Promise<void> {
    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
        'vscode.executeFormatDocumentProvider',
        vscode.window.activeTextEditor!.document.uri,
        {
            insertSpaces: true,
            tabSize: 4,
        }
    );

    await applyEditsAsync(edits);
}

export async function formatRangeAsync(range: vscode.Range): Promise<void> {
    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
        'vscode.executeFormatRangeProvider',
        vscode.window.activeTextEditor!.document.uri,
        range,
        {
            insertSpaces: true,
            tabSize: 4,
        }
    );

    await applyEditsAsync(edits);
}

export async function formatOnTypeAsync(position: vscode.Position, character: string): Promise<void> {
    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
        'vscode.executeFormatOnTypeProvider',
        vscode.window.activeTextEditor!.document.uri,
        position,
        character,
        {
            insertSpaces: true,
            tabSize: 4,
        }
    );

    await applyEditsAsync(edits);
}

async function applyEditsAsync(edits: vscode.TextEdit[]): Promise<void> {
    expect(edits).toBeDefined();

    const workspaceEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.set(vscode.window.activeTextEditor!.document.uri, edits);
    const succeeded = await vscode.workspace.applyEdit(workspaceEdit);
    expect(succeeded).toBe(true);
}

export async function expectText(expectedLines: string[]) {
    const expectedText = expectedLines.join(EOL);
    expect(vscode.window.activeTextEditor!.document.getText()).toBe(expectedText);
}

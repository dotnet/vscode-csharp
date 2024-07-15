/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export async function getCompletionsAsync(
    position: vscode.Position,
    triggerCharacter: string | undefined,
    completionsToResolve: number
): Promise<vscode.CompletionList> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        throw new Error('No active editor');
    }

    return await vscode.commands.executeCommand(
        'vscode.executeCompletionItemProvider',
        activeEditor.document.uri,
        position,
        triggerCharacter,
        completionsToResolve
    );
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { beforeAll, afterAll, test, expect, beforeEach } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from '../../lsptoolshost/integrationTests/integrationHelpers';

integrationHelpers.describeIfWindows(`Razor Completion ${testAssetWorkspace.description}`, function () {
    beforeAll(async function () {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        await integrationHelpers.activateCSharpExtension();
    });

    beforeEach(async function () {
        await integrationHelpers.openFileInWorkspaceAsync(path.join('Pages', 'Completion.razor'));
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Text Tag', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const completionList = await getCompletionsAsync(new vscode.Position(4, 7), 'e');
        expect(completionList.items.length).toBeGreaterThan(0);
        const textTagCompletionItem = completionList.items.find((item) => item.label === 'text');

        if (!textTagCompletionItem) {
            throw new Error(completionList.items.reduce((acc, item) => acc + item.label + '\n', ''));
        }

        expect(textTagCompletionItem).toBeDefined();
        expect(textTagCompletionItem!.kind).toEqual(vscode.CompletionItemKind.Text);
        expect(textTagCompletionItem!.insertText).toBe('text');
    });

    async function getCompletionsAsync(
        position: vscode.Position,
        triggerCharacter: string | undefined
    ): Promise<vscode.CompletionList> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            throw new Error('No active editor');
        }

        return await vscode.commands.executeCommand(
            'vscode.executeCompletionItemProvider',
            activeEditor.document.uri,
            position,
            triggerCharacter
        );
    }
});

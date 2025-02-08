/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { beforeAll, afterAll, test, expect, beforeEach, describe } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from '../../lsptoolshost/integrationTests/integrationHelpers';

describe.skip(`Razor Completion ${testAssetWorkspace.description}`, function () {
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

        const insertPosition = new vscode.Position(4, 4);
        await insertText(insertPosition, '<te');
        const completionList = await getCompletionsAsync(new vscode.Position(4, 7), 'e', undefined);
        expect(completionList.items.length).toBeGreaterThan(0);
        const textTagCompletionItem = completionList.items.find((item) => item.label === 'text');

        if (!textTagCompletionItem) {
            throw new Error(completionList.items.reduce((acc, item) => acc + item.label + '\n', ''));
        }

        expect(textTagCompletionItem).toBeDefined();
        expect(textTagCompletionItem!.kind).toEqual(vscode.CompletionItemKind.Text);
        expect(textTagCompletionItem!.insertText).toBe('text');
    });

    test('Div Tag', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const insertPosition = new vscode.Position(6, 0);
        await insertText(insertPosition, '<di');
        const completionList = await getCompletionsAsync(new vscode.Position(6, 3), undefined, 10);
        expect(completionList.items.length).toBeGreaterThan(0);
        const divTagCompletionItem = completionList.items.find((item) => item.label === 'div');

        if (!divTagCompletionItem) {
            throw new Error(completionList.items.reduce((acc, item) => acc + item.label + '\n', ''));
        }

        expect(divTagCompletionItem).toBeDefined();

        // Reader, you may be wondering why the kind is a Property. To that I say: I don't know.
        // If you find out please add a detailed explanation. Thank you in advance.
        expect(divTagCompletionItem!.kind).toEqual(vscode.CompletionItemKind.Property);
        expect(divTagCompletionItem!.insertText).toBe('div');

        const documentation = divTagCompletionItem!.documentation as vscode.MarkdownString;
        expect(documentation.value).toBe(
            'The div element has no special meaning at all. It represents its children. It can be used with the class, lang, and title attributes to mark up semantics common to a group of consecutive elements.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/div)'
        );
    });

    async function getCompletionsAsync(
        position: vscode.Position,
        triggerCharacter: string | undefined,
        resolveCount: number | undefined
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
            resolveCount
        );
    }

    async function insertText(position: vscode.Position, text: string): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            throw new Error('No active editor');
        }

        await activeEditor.edit((builder) => {
            builder.insert(position, text);
        });
    }
});

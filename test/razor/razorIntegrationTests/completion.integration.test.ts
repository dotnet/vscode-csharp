/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { beforeAll, afterAll, test, expect, beforeEach, describe } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from '../../lsptoolshost/integrationTests/integrationHelpers';

describe(`Razor Completion ${testAssetWorkspace.description}`, function () {
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

        const activeDocument = vscode.window.activeTextEditor?.document.uri;
        if (!activeDocument) {
            throw new Error('No active document');
        }

        await waitForExpectedCompletionItemAsync(
            new vscode.Position(9, 7),
            undefined,
            undefined,
            'text',
            vscode.CompletionItemKind.TypeParameter,
            'text'
        );
    });

    test('Div Tag', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const expectedDocumentation = `The div element has no special meaning at all. It represents its children. It can be used with the class, lang, and title attributes to mark up semantics common to a group of consecutive elements.

![Baseline icon](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTAiIHZpZXdCb3g9IjAgMCA1NDAgMzAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxzdHlsZT4KICAgIC5ncmVlbi1zaGFwZSB7CiAgICAgIGZpbGw6ICNDNEVFRDA7IC8qIExpZ2h0IG1vZGUgKi8KICAgIH0KCiAgICBAbWVkaWEgKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKSB7CiAgICAgIC5ncmVlbi1zaGFwZSB7CiAgICAgICAgZmlsbDogIzEyNTIyNTsgLyogRGFyayBtb2RlICovCiAgICAgIH0KICAgIH0KICA8L3N0eWxlPgogIDxwYXRoIGQ9Ik00MjAgMzBMMzkwIDYwTDQ4MCAxNTBMMzkwIDI0MEwzMzAgMTgwTDMwMCAyMTBMMzkwIDMwMEw1NDAgMTUwTDQyMCAzMFoiIGNsYXNzPSJncmVlbi1zaGFwZSIvPgogIDxwYXRoIGQ9Ik0xNTAgMEwzMCAxMjBMNjAgMTUwTDE1MCA2MEwyMTAgMTIwTDI0MCA5MEwxNTAgMFoiIGNsYXNzPSJncmVlbi1zaGFwZSIvPgogIDxwYXRoIGQ9Ik0zOTAgMEw0MjAgMzBMMTUwIDMwMEwwIDE1MEwzMCAxMjBMMTUwIDI0MEwzOTAgMFoiIGZpbGw9IiMxRUE0NDYiLz4KPC9zdmc+) _Widely available across major browsers (Baseline since 2015)_

[MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Reference/Elements/div)`;
        await waitForExpectedCompletionItemAsync(
            new vscode.Position(11, 3),
            undefined,
            undefined,
            'div',
            vscode.CompletionItemKind.Property,
            'div',
            expectedDocumentation
        );
    }, 30000);

    test('At-DateTime', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const activeDocument = vscode.window.activeTextEditor?.document.uri;
        if (!activeDocument) {
            throw new Error('No active document');
        }

        await waitForExpectedCompletionItemAsync(
            new vscode.Position(2, 1),
            undefined,
            undefined,
            'DateTime',
            vscode.CompletionItemKind.Struct,
            'DateTime'
        );
    });

    test('DateTime', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const activeDocument = vscode.window.activeTextEditor?.document.uri;
        if (!activeDocument) {
            throw new Error('No active document');
        }

        await waitForExpectedCompletionItemAsync(
            new vscode.Position(5, 13),
            undefined,
            undefined,
            'DateTime',
            vscode.CompletionItemKind.Struct,
            'DateTime'
        );
    });

    test('Provisional completion', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const activeDocument = vscode.window.activeTextEditor?.document.uri;
        if (!activeDocument) {
            throw new Error('No active document');
        }

        await waitForExpectedCompletionItemAsync(
            new vscode.Position(1, 10),
            '.',
            1,
            'Now',
            vscode.CompletionItemKind.Property,
            'Now',
            undefined // TODO: Put in an expected doc string when https://github.com/dotnet/razor/pull/12403 inserts
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

    async function waitForExpectedCompletionItemAsync(
        position: vscode.Position,
        triggerCharacter: string | undefined,
        resolvedItemCount: number | undefined,
        expectedLabel: string,
        expectedKind: vscode.CompletionItemKind,
        expectedInsertText: string,
        expectedDocumentation: string | undefined = undefined
    ): Promise<void> {
        const duration = 30 * 1000;
        const step = 500;

        await integrationHelpers.waitForExpectedResult<vscode.CompletionList>(
            async () => {
                const completions = await getCompletionsAsync(position, triggerCharacter, resolvedItemCount);
                return completions;
            },
            duration,
            step,
            (completionList) => {
                if (!completionList) {
                    throw new Error('No completion list');
                }
                expect(completionList.items.length).toBeGreaterThan(0);

                const completionItem = completionList.items.find((item) => item.label === expectedLabel);
                if (!completionItem) {
                    throw new Error();
                }
                expect(completionItem).toBeDefined();
                expect(completionItem!.kind).toEqual(expectedKind);
                expect(completionItem!.insertText).toBe(expectedInsertText);
                if (expectedDocumentation) {
                    const documentation = completionItem!.documentation as vscode.MarkdownString;
                    expect(documentation.value).toBe(expectedDocumentation);
                }
            }
        );
    }
});

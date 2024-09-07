/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import OmniSharpCompletionProvider from '../../../src/omnisharp/features/completionProvider';
import * as vscode from 'vscode';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import * as path from 'path';
import { activateCSharpExtension, describeIfNotRazorOrGenerator } from './integrationHelpers';

describeIfNotRazorOrGenerator(`${OmniSharpCompletionProvider.name}: Returns the completion items`, () => {
    let fileUri: vscode.Uri;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        const fileName = 'completion.cs';
        const dir = testAssetWorkspace.projects[0].projectDirectoryPath;
        fileUri = vscode.Uri.file(path.join(dir, fileName));
        await vscode.commands.executeCommand('vscode.open', fileUri);

        // The override bit is commented out to allow later debugging to work correctly.
        const overrideUncomment = new vscode.WorkspaceEdit();
        overrideUncomment.delete(fileUri, new vscode.Range(new vscode.Position(11, 8), new vscode.Position(11, 11)));
        await vscode.workspace.applyEdit(overrideUncomment);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Returns the completion items', async () => {
        const completionList = <vscode.CompletionList>(
            await vscode.commands.executeCommand(
                'vscode.executeCompletionItemProvider',
                fileUri,
                new vscode.Position(8, 31),
                ' '
            )
        );
        expect(completionList.items.length).toBeGreaterThan(0);
    });

    test('Resolve adds documentation', async () => {
        const completionList = <vscode.CompletionList>(
            await vscode.commands.executeCommand(
                'vscode.executeCompletionItemProvider',
                fileUri,
                new vscode.Position(8, 31),
                /*trigger character*/ undefined,
                /* completions to resolve */ 10
            )
        );
        // At least some of the first 10 fully-resolved elements should have documentation attached. If this ever ends up not being
        // true, adjust the cutoff appropriately.
        const documentation = completionList.items.slice(0, 9).filter((item) => item.documentation);
        expect(documentation.length).toBeGreaterThan(0);
    });

    test('Override completion has additional edits sync', async () => {
        const completionList = <vscode.CompletionList>(
            await vscode.commands.executeCommand(
                'vscode.executeCompletionItemProvider',
                fileUri,
                new vscode.Position(11, 17),
                ' ',
                4
            )
        );
        const nonSnippets = completionList.items.filter((c) => c.kind != vscode.CompletionItemKind.Snippet);

        let sawAdditionalTextEdits = false;
        let sawEmptyAdditionalTextEdits = false;

        for (const i of nonSnippets) {
            expect((<vscode.SnippetString>i.insertText).value).not.toBe(undefined);
            expect((<vscode.SnippetString>i.insertText).value).toContain('$0');
            if (i.additionalTextEdits) {
                sawAdditionalTextEdits = true;
                expect(i.additionalTextEdits.length).toEqual(1);
                expect(normalizeNewlines(i.additionalTextEdits[0].newText)).toEqual('using singleCsproj2;\n');
                expect(i.additionalTextEdits[0].range.start.line).toEqual(1);
                expect(i.additionalTextEdits[0].range.start.character).toEqual(0);
                expect(i.additionalTextEdits[0].range.end.line).toEqual(1);
                // Can be either 0 or 1, depending on the platform this test is run on
                expect(i.additionalTextEdits[0].range.end.character).toBeLessThanOrEqual(1);
                expect(i.additionalTextEdits[0].range.end.character).toBeGreaterThanOrEqual(0);
            } else {
                sawEmptyAdditionalTextEdits = true;
            }
        }

        expect(sawAdditionalTextEdits).toBe(true);
        expect(sawEmptyAdditionalTextEdits).toBe(true);
    });

    function normalizeNewlines(text: string) {
        // using directives are now added with the line ending used by other
        // using directives in the file instead of the formatting option end_of_line.
        return text.replaceAll('\r\n', '\n');
    }
});

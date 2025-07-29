/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as lsp from 'vscode-languageserver-protocol';
import * as vscode from 'vscode';
import * as path from 'path';
import { describe, beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import {
    activateCSharpExtension,
    closeAllEditorsAsync,
    getCodeLensesAsync,
    openFileInWorkspaceAsync,
} from './integrationHelpers';

describe(`CodeLens Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    beforeEach(async () => {
        const fileName = path.join('src', 'app', 'reference.cs');
        await openFileInWorkspaceAsync(fileName);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('CodeLens references are displayed', async () => {
        const codeLenses = await getCodeLensesAsync();
        expect(codeLenses).toHaveLength(4);

        const fooPosition: lsp.Position = { line: 4, character: 17 };
        const fooRange = new vscode.Range(
            new vscode.Position(fooPosition.line, fooPosition.character),
            new vscode.Position(fooPosition.line, fooPosition.character + 3)
        );

        const fooBazPosition: lsp.Position = { line: 6, character: 20 };
        const fooBazRange = new vscode.Range(
            new vscode.Position(fooBazPosition.line, fooBazPosition.character),
            new vscode.Position(fooBazPosition.line, fooBazPosition.character + 3)
        );

        const barPosition: lsp.Position = { line: 9, character: 17 };
        const barRange = new vscode.Range(
            new vscode.Position(barPosition.line, barPosition.character),
            new vscode.Position(barPosition.line, barPosition.character + 3)
        );

        const barBarPosition: lsp.Position = { line: 11, character: 15 };
        const barBarRange = new vscode.Range(
            new vscode.Position(barBarPosition.line, barBarPosition.character),
            new vscode.Position(barBarPosition.line, barBarPosition.character + 3)
        );

        // Foo references
        expect(codeLenses[0].command?.command).toBe('roslyn.client.peekReferences');
        expect(codeLenses[0].command?.title).toBe('1 reference');
        expect(codeLenses[0].command?.arguments![1]).toEqual(fooPosition);
        expect(codeLenses[0].range).toEqual(fooRange);

        // For.Baz references
        expect(codeLenses[1].command?.command).toBe('roslyn.client.peekReferences');
        expect(codeLenses[1].command?.title).toBe('1 reference');
        expect(codeLenses[1].command?.arguments![1]).toEqual(fooBazPosition);
        expect(codeLenses[1].range).toEqual(fooBazRange);

        // Bar references
        expect(codeLenses[2].command?.command).toBe('roslyn.client.peekReferences');
        expect(codeLenses[2].command?.title).toBe('1 reference');
        expect(codeLenses[2].command?.arguments![1]).toEqual(barPosition);
        expect(codeLenses[2].range).toEqual(barRange);

        // Bar.Bar references
        expect(codeLenses[3].command?.command).toBe('roslyn.client.peekReferences');
        expect(codeLenses[3].command?.title).toBe('0 references');
        expect(codeLenses[3].command?.arguments![1]).toEqual(barBarPosition);
        expect(codeLenses[3].range).toEqual(barBarRange);
    });

    test('CodeLens references selected', async () => {
        const codeLenses = await getCodeLensesAsync();
        const peekCommand = codeLenses[0].command!;

        // There's no way to directly test that the peek window correctly opens, so just assert that nothing threw an error.
        await expect(
            vscode.commands.executeCommand<Promise<void>>(
                peekCommand.command,
                peekCommand.arguments![0],
                peekCommand.arguments![1]
            )
        ).resolves.toBeUndefined();
    });
});

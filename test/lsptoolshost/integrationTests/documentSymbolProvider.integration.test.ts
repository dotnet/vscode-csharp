/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll, describe, afterEach, beforeEach } from '@jest/globals';
import * as vscode from 'vscode';
import * as path from 'path';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { activateCSharpExtension, closeAllEditorsAsync, openFileInWorkspaceAsync } from './integrationHelpers';

describe(`Document Symbol Tests`, () => {
    let fileUri: vscode.Uri;

    beforeAll(async () => {
        await activateCSharpExtension();
    });

    beforeEach(async () => {
        const relativePath = path.join('src', 'app', 'documentSymbols.cs');
        fileUri = await openFileInWorkspaceAsync(relativePath);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('Returns all elements', async () => {
        const symbols = await GetDocumentSymbols(fileUri);

        expect(symbols).toHaveLength(5);

        // Class C
        expect(symbols[0].name).toBe('C');
        expect(symbols[0].detail).toBe('Test.C');
        expect(symbols[0].kind).toBe(vscode.SymbolKind.Class);
        // The range is the entire class, but the selection range is the class name
        expect(symbols[0].range).toStrictEqual(new vscode.Range(new vscode.Position(4, 4), new vscode.Position(37, 5)));
        expect(symbols[0].selectionRange).toStrictEqual(
            new vscode.Range(new vscode.Position(4, 10), new vscode.Position(4, 11))
        );
        expect(symbols[0].children).toHaveLength(20);

        // Field _f
        expect(symbols[0].children[0].name).toBe('_f');
        expect(symbols[0].children[0].kind).toBe(vscode.SymbolKind.Field);

        // Finalize
        expect(symbols[0].children[3].name).toBe('~C');
        expect(symbols[0].children[3].kind).toBe(vscode.SymbolKind.Method);

        // Ctor
        expect(symbols[0].children[4].name).toBe('C');
        expect(symbols[0].children[4].kind).toBe(vscode.SymbolKind.Method);

        // EventHandler E1
        expect(symbols[0].children[5].name).toBe('E1');
        expect(symbols[0].children[5].kind).toBe(vscode.SymbolKind.Event);

        // explicit operator int(C c1)
        expect(symbols[0].children[11].name).toBe('explicit operator Int32');
        expect(symbols[0].children[11].detail).toBe('explicit operator int(C c1)');
        expect(symbols[0].children[11].kind).toBe(vscode.SymbolKind.Operator);

        // implicit operator int(C c1)
        expect(symbols[0].children[12].name).toBe('implicit operator C');
        expect(symbols[0].children[12].detail).toBe('implicit operator C(int i)');
        expect(symbols[0].children[12].kind).toBe(vscode.SymbolKind.Operator);

        // Method M1
        expect(symbols[0].children[13].name).toBe('M1');
        expect(symbols[0].children[13].detail).toBe('M1(int i, string s, params object[] args)');
        expect(symbols[0].children[13].kind).toBe(vscode.SymbolKind.Method);

        // operator !=
        expect(symbols[0].children[14].name).toBe('operator !=');
        expect(symbols[0].children[14].detail).toBe('operator !=(C c1, int i)');
        expect(symbols[0].children[14].kind).toBe(vscode.SymbolKind.Operator);

        // Property P1
        expect(symbols[0].children[16].name).toBe('P1');
        expect(symbols[0].children[16].kind).toBe(vscode.SymbolKind.Property);

        // Struct S
        expect(symbols[1].name).toBe('S');
        expect(symbols[1].detail).toBe('Test.S');
        expect(symbols[1].kind).toBe(vscode.SymbolKind.Struct);

        // Interface I
        expect(symbols[2].name).toBe('I');
        expect(symbols[2].detail).toBe('Test.I');
        expect(symbols[2].kind).toBe(vscode.SymbolKind.Interface);

        // Delegate D
        expect(symbols[3].name).toBe('D');
        expect(symbols[3].detail).toBe('Test.D');
        expect(symbols[3].kind).toBe(vscode.SymbolKind.Method);

        // Enum E
        expect(symbols[4].name).toBe('E');
        expect(symbols[4].detail).toBe('Test.E');
        expect(symbols[4].kind).toBe(vscode.SymbolKind.Enum);
    });
});

async function GetDocumentSymbols(fileUri: vscode.Uri) {
    return <vscode.DocumentSymbol[]>(
        await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', fileUri)
    );
}

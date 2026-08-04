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

        expect(symbols).toHaveLength(1);

        // Namespace Test
        expect(symbols[0].name).toBe('Test');
        expect(symbols[0].kind).toBe(vscode.SymbolKind.Namespace);
        expect(symbols[0].children).toHaveLength(5);

        const namespaceChildren = symbols[0].children;

        // Class C
        expect(namespaceChildren[0].name).toBe('C');
        expect(namespaceChildren[0].kind).toBe(vscode.SymbolKind.Class);
        // The range is the entire class, but the selection range is the class name
        expect(namespaceChildren[0].range).toStrictEqual(
            new vscode.Range(new vscode.Position(4, 4), new vscode.Position(37, 5))
        );
        expect(namespaceChildren[0].selectionRange).toStrictEqual(
            new vscode.Range(new vscode.Position(4, 10), new vscode.Position(4, 11))
        );
        expect(namespaceChildren[0].children).toHaveLength(18);

        // Field _f
        expect(namespaceChildren[0].children[0].name).toBe('_f : int');
        expect(namespaceChildren[0].children[0].kind).toBe(vscode.SymbolKind.Field);

        // Ctor
        expect(namespaceChildren[0].children[3].name).toBe('C()');
        expect(namespaceChildren[0].children[3].kind).toBe(vscode.SymbolKind.Method);

        // Finalize
        expect(namespaceChildren[0].children[4].name).toBe('~C()');
        expect(namespaceChildren[0].children[4].kind).toBe(vscode.SymbolKind.Method);

        // Method M1
        expect(namespaceChildren[0].children[5].name).toBe('M1(int, string, object[]) : void');
        expect(namespaceChildren[0].children[5].detail).toBe('M1(int, string, object[]) : void');
        expect(namespaceChildren[0].children[5].kind).toBe(vscode.SymbolKind.Method);

        // Property P1
        expect(namespaceChildren[0].children[6].name).toBe('P1 : int');
        expect(namespaceChildren[0].children[6].kind).toBe(vscode.SymbolKind.Property);

        // EventHandler E1
        expect(namespaceChildren[0].children[10].name).toBe('E1 : EventHandler');
        expect(namespaceChildren[0].children[10].kind).toBe(vscode.SymbolKind.Event);

        // operator !=
        expect(namespaceChildren[0].children[15].name).toBe('operator !=(C, int) : bool');
        expect(namespaceChildren[0].children[15].detail).toBe('operator !=(C, int) : bool');
        expect(namespaceChildren[0].children[15].kind).toBe(vscode.SymbolKind.Operator);

        // implicit operator C(int)
        expect(namespaceChildren[0].children[16].name).toBe('implicit operator C(int)');
        expect(namespaceChildren[0].children[16].detail).toBe('implicit operator C(int)');
        expect(namespaceChildren[0].children[16].kind).toBe(vscode.SymbolKind.Operator);

        // explicit operator int(C)
        expect(namespaceChildren[0].children[17].name).toBe('explicit operator int(C)');
        expect(namespaceChildren[0].children[17].detail).toBe('explicit operator int(C)');
        expect(namespaceChildren[0].children[17].kind).toBe(vscode.SymbolKind.Operator);

        // Struct S
        expect(namespaceChildren[1].name).toBe('S');
        expect(namespaceChildren[1].kind).toBe(vscode.SymbolKind.Struct);

        // Interface I
        expect(namespaceChildren[2].name).toBe('I');
        expect(namespaceChildren[2].kind).toBe(vscode.SymbolKind.Interface);

        // Delegate D
        expect(namespaceChildren[3].name).toBe('D() : void');
        expect(namespaceChildren[3].kind).toBe(vscode.SymbolKind.Method);

        // Enum E
        expect(namespaceChildren[4].name).toBe('E');
        expect(namespaceChildren[4].kind).toBe(vscode.SymbolKind.Enum);
    });
});

async function GetDocumentSymbols(fileUri: vscode.Uri) {
    return <vscode.DocumentSymbol[]>(
        await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', fileUri)
    );
}

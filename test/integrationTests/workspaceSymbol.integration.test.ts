/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { activateCSharpExtension, closeAllEditorsAsync, compareLocations } from './integrationHelpers';
import { describe, beforeAll, afterAll, test, expect, afterEach } from '@jest/globals';

describe(`[${testAssetWorkspace.description}] Workspace Symbol Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('Go to finds multiple symbols in workspace', async () => {
        const symbols = await getWorkspaceSymbols('Completion');

        expect(symbols).toHaveLength(3);

        expect(symbols[0].name).toEqual('Completion');
        expect(symbols[0].containerName).toContain('project app');
        expect(symbols[0].kind).toEqual(vscode.SymbolKind.Class);
        expect(symbols[0].location.uri.fsPath).toContain('completion.cs');
        expect(symbols[0].location.range).toEqual(new vscode.Range(4, 10, 4, 20));

        expect(symbols[1].name).toEqual('shouldHaveCompletions');
        expect(symbols[1].containerName).toContain('in Completion');
        expect(symbols[1].kind).toEqual(vscode.SymbolKind.Method);
        expect(symbols[1].location.uri.fsPath).toContain('completion.cs');
        expect(symbols[1].location.range).toEqual(new vscode.Range(6, 20, 6, 41));

        expect(symbols[2].name).toEqual('CompletionBase');
        expect(symbols[2].containerName).toContain('project app');
        expect(symbols[2].kind).toEqual(vscode.SymbolKind.Class);
        expect(symbols[2].location.uri.fsPath).toContain('completionBase.cs');
        expect(symbols[2].location.range).toEqual(new vscode.Range(4, 10, 4, 24));
    });

    test('Go to finds single method in workspace', async () => {
        const symbols = await getWorkspaceSymbols('TestMain');

        expect(symbols).toHaveLength(1);
        expect(symbols[0].name).toEqual('TestMain');
        expect(symbols[0].containerName).toContain('in TestProgram');
        expect(symbols[0].kind).toEqual(vscode.SymbolKind.Method);
        expect(symbols[0].location.uri.fsPath).toContain('semantictokens.cs');
        expect(symbols[0].location.range).toEqual(new vscode.Range(4, 26, 4, 34));
    });
});

async function getWorkspaceSymbols(filter: string): Promise<vscode.SymbolInformation[]> {
    const symbols = <vscode.SymbolInformation[]>(
        await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', filter)
    );

    symbols.sort((a, b) => compareLocations(a.location, b.location));
    return symbols;
}

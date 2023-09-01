/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { expect, should } from 'chai';
import { activateCSharpExtension, isRazorWorkspace, isSlnWithGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/omnisharpTestAssetWorkspace';

suite(`WorkspaceSymbolProvider: ${testAssetWorkspace.description}`, function () {
    suiteSetup(async function () {
        should();

        if (isRazorWorkspace(vscode.workspace) || isSlnWithGenerator(vscode.workspace)) {
            this.skip();
        }

        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();
        const projectDirectory = vscode.Uri.file(testAssetWorkspace.projects[0].projectDirectoryPath);
        await vscode.commands.executeCommand('vscode.open', projectDirectory);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Returns elements', async function () {
        const symbols = await GetWorkspaceSymbols('P');
        expect(symbols.length).to.be.greaterThan(0);
    });

    test('Returns no elements when minimum filter length is configured and search term is shorter', async function () {
        const omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        await omnisharpConfig.update('minFindSymbolsFilterLength', 2);

        const symbols = await GetWorkspaceSymbols('P');
        expect(symbols.length).to.be.equal(0);
    });

    test('Returns elements when minimum filter length is configured and search term is longer or equal', async function () {
        const omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        await omnisharpConfig.update('minFindSymbolsFilterLength', 2);

        const symbols = await GetWorkspaceSymbols('P1');
        expect(symbols.length).to.be.greaterThan(0);
    });
});

async function GetWorkspaceSymbols(filter: string) {
    return <vscode.SymbolInformation[]>(
        await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', filter)
    );
}

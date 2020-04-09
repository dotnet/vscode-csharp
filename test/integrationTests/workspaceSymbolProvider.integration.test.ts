/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { expect } from 'chai';
import { activateCSharpExtension, isRazorWorkspace } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`WorkspaceSymbolProvider: ${testAssetWorkspace.description}`, function () {

    suiteSetup(async function () {
        // These tests don't run on the BasicRazorApp2_1 solution
        if (isRazorWorkspace(vscode.workspace)) {
            this.skip();
        }

        await activateCSharpExtension();
        await testAssetWorkspace.restore();
        let projectDirectory = vscode.Uri.file(testAssetWorkspace.projects[0].projectDirectoryPath);
        await vscode.commands.executeCommand("vscode.open", projectDirectory);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns elements", async function () {
        let symbols = await GetWorkspaceSymbols("P");
        expect(symbols.length).to.be.greaterThan(0);
    });

    test("Returns no elements when minimum filter length is configured and search term is shorter", async function () {
        let omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        await omnisharpConfig.update('minFindSymbolsFilterLength', 2);

        let symbols = await GetWorkspaceSymbols("P");
        expect(symbols.length).to.be.equal(0);
    });

    test("Returns elements when minimum filter length is configured and search term is longer or equal", async function () {
        let omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        await omnisharpConfig.update('minFindSymbolsFilterLength', 2);

        let symbols = await GetWorkspaceSymbols("P1");
        expect(symbols.length).to.be.greaterThan(0);
    });
});

async function GetWorkspaceSymbols(filter: string) {
    return <vscode.SymbolInformation[]>await vscode.commands.executeCommand("vscode.executeWorkspaceSymbolProvider", filter);
}
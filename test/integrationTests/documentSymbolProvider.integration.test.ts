/*--------------------------------------------------------------------------------------------- 
*  Copyright (c) Microsoft Corporation. All rights reserved. 
*  Licensed under the MIT License. See License.txt in the project root for license information. 
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

import { should, expect } from 'chai';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { dotnetRestore } from '../../src/features/commands';
import { EventStream } from '../../src/EventStream';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`DocumentSymbolProvider: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();
        await dotnetRestore(vscode.workspace.rootPath, new EventStream());
        await activateCSharpExtension();

        let fileName = 'documentSymbols.cs';
        let projectDirectory = path.dirname(testAssetWorkspace.projects[0].projectDirectoryPath);
        let filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);

        await vscode.commands.executeCommand("vscode.open", fileUri);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns all elements", async function () {
        let symbols = await GetDocumentSymbols(fileUri);
        expect(symbols.length).to.equal(25);
    });
});

async function GetDocumentSymbols(fileUri: vscode.Uri) {
    return <vscode.SymbolInformation[]>await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", fileUri);
}
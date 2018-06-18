/*--------------------------------------------------------------------------------------------- 
*  Copyright (c) Microsoft Corporation. All rights reserved. 
*  Licensed under the MIT License. See License.txt in the project root for license information. 
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

import { should, expect } from 'chai';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`CodeLensProvider: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();
        await testAssetWorkspace.restore();
        await activateCSharpExtension();

        let fileName = 'Program.cs';
        let projectDirectory = path.dirname(testAssetWorkspace.projects[0].projectDirectoryPath);
        let filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);

        await vscode.commands.executeCommand("vscode.open", fileUri);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns all code lenses", async function () {
        let codeLenses = await GetCodeLenses(fileUri);
        expect(codeLenses.length).to.equal(2);

        for (let codeLens of codeLenses) {
            expect(codeLens.isResolved).to.be.false;
            expect(codeLens.command).to.be.undefined;
        }
    });

    test("Returns all resolved code lenses", async function () {
        let codeLenses = await GetCodeLenses(fileUri, 100);
        expect(codeLenses.length).to.equal(2);

        for (let codeLens of codeLenses) {
            expect(codeLens.isResolved).to.be.true;
            expect(codeLens.command).not.to.be.undefined;
            expect(codeLens.command.title).to.equal("0 references");
        }
    });
});

async function GetCodeLenses(fileUri: vscode.Uri, resolvedItemCount?: number) {
    return <vscode.CodeLens[]>await vscode.commands.executeCommand("vscode.executeCodeLensProvider", fileUri, resolvedItemCount);
}
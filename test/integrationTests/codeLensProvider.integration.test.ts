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
        await activateCSharpExtension();
        await testAssetWorkspace.restore();

        let fileName = 'Program.cs';
        let projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        let filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);

        let csharpConfig = vscode.workspace.getConfiguration('csharp');
        await csharpConfig.update('referencesCodeLens.enabled', true);
        await csharpConfig.update('testsCodeLens.enabled', true);

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

suite(`CodeLensProvider options: ${testAssetWorkspace.description}`, function() {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        // These tests only run on the slnWithCsproj solution
        if (vscode.workspace.workspaceFolders[0].uri.fsPath.split(path.sep).pop() !== 'slnWithCsproj') {
            this.skip();
        }
        else
        {
            await activateCSharpExtension();
            await testAssetWorkspace.restore();

            let fileName = 'UnitTest1.cs';
            let projectDirectory = testAssetWorkspace.projects[2].projectDirectoryPath;
            let filePath = path.join(projectDirectory, fileName);
            fileUri = vscode.Uri.file(filePath);

            await vscode.commands.executeCommand("vscode.open", fileUri);
        }
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    /* Skip this test until we are able to understand the cause of flakiness */
    test.skip("Returns no references code lenses when 'csharp.referencesCodeLens.enabled' option is set to false", async function () {
        let csharpConfig = vscode.workspace.getConfiguration('csharp');
        await csharpConfig.update('referencesCodeLens.enabled', false);
        await csharpConfig.update('testsCodeLens.enabled', true);

        let codeLenses = await GetCodeLenses(fileUri, 100);
        expect(codeLenses.length).to.equal(4);

        for (let codeLens of codeLenses) {
            expect(codeLens.isResolved).to.be.true;
            expect(codeLens.command).not.to.be.undefined;
            expect(codeLens.command.command).to.be.oneOf(['dotnet.test.run', 'dotnet.classTests.run', 'dotnet.test.debug', 'dotnet.classTests.debug']);
            expect(codeLens.command.title).to.be.oneOf(['Run Test', 'Run All Tests', 'Debug Test', 'Debug All Tests']);
        }
    });

    test("Returns no test code lenses when 'csharp.testsCodeLens.enabled' option is set to false", async function () {
        let csharpConfig = vscode.workspace.getConfiguration('csharp');
        await csharpConfig.update('referencesCodeLens.enabled', true);
        await csharpConfig.update('testsCodeLens.enabled', false);

        let codeLenses = await GetCodeLenses(fileUri, 100);
        expect(codeLenses.length).to.equal(2);

        for (let codeLens of codeLenses) {
            expect(codeLens.isResolved).to.be.true;
            expect(codeLens.command).not.to.be.undefined;
            expect(codeLens.command.command).to.be.equal('editor.action.showReferences');
            expect(codeLens.command.title).to.equal('0 references');
        }
    });

    test("Returns no code lenses when 'csharp.referencesCodeLens.enabled' and 'csharp.testsCodeLens.enabled' options are set to false", async function () {
        let csharpConfig = vscode.workspace.getConfiguration('csharp');
        await csharpConfig.update('referencesCodeLens.enabled', false);
        await csharpConfig.update('testsCodeLens.enabled', false);

        let codeLenses = await GetCodeLenses(fileUri, 100);
        expect(codeLenses.length).to.equal(0);
    });
});

async function GetCodeLenses(fileUri: vscode.Uri, resolvedItemCount?: number) {
    return <vscode.CodeLens[]>await vscode.commands.executeCommand("vscode.executeCodeLensProvider", fileUri, resolvedItemCount);
}
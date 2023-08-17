/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

import { should, expect } from 'chai';
import { activateCSharpExtension, isSlnWithCsproj, isSlnWithGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { isNotNull } from '../testUtil';

suite(`CodeLensProvider: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        if (isSlnWithGenerator(vscode.workspace)) {
            this.skip();
        }

        should();
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        const fileName = 'Program.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        const filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);

        const csharpConfig = vscode.workspace.getConfiguration('dotnet');
        await csharpConfig.update('codeLens.enableReferencesCodeLens', true);
        await csharpConfig.update('codeLens.enableTestsCodeLens', true);

        await vscode.commands.executeCommand('vscode.open', fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Returns all code lenses', async function () {
        const codeLenses = await GetCodeLenses(fileUri);
        expect(codeLenses.length).to.equal(2);

        for (const codeLens of codeLenses) {
            expect(codeLens.isResolved).to.be.false;
            expect(codeLens.command).to.be.undefined;
        }
    });

    test('Returns all resolved code lenses', async function () {
        const codeLenses = await GetCodeLenses(fileUri, 100);
        expect(codeLenses.length).to.equal(2);

        for (const codeLens of codeLenses) {
            expect(codeLens.isResolved).to.be.true;
            isNotNull(codeLens.command);
            expect(codeLens.command.title).to.equal('0 references');
        }
    });
});

suite(`CodeLensProvider options: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        // These tests only run on the slnWithCsproj solution
        if (!isSlnWithCsproj(vscode.workspace)) {
            this.skip();
        } else {
            const activation = await activateCSharpExtension();
            await testAssetWorkspace.restoreAndWait(activation);

            const fileName = 'UnitTest1.cs';
            const projectDirectory = testAssetWorkspace.projects[2].projectDirectoryPath;
            const filePath = path.join(projectDirectory, fileName);
            fileUri = vscode.Uri.file(filePath);

            await vscode.commands.executeCommand('vscode.open', fileUri);
        }
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    /* Skip this test until we are able to understand the cause of flakiness */
    test.skip("Returns no references code lenses when 'dotnet.codeLens.enableReferencesCodeLens' option is set to false", async function () {
        const csharpConfig = vscode.workspace.getConfiguration('dotnet');
        await csharpConfig.update('codeLens.enableReferencesCodeLens', false);
        await csharpConfig.update('codeLens.enableTestsCodeLens', true);

        const codeLenses = await GetCodeLenses(fileUri, 100);
        expect(codeLenses.length).to.equal(4);

        for (const codeLens of codeLenses) {
            expect(codeLens.isResolved).to.be.true;
            isNotNull(codeLens.command);
            expect(codeLens.command.command).to.be.oneOf([
                'dotnet.test.run',
                'dotnet.classTests.run',
                'dotnet.test.debug',
                'dotnet.classTests.debug',
            ]);
            expect(codeLens.command.title).to.be.oneOf(['Run Test', 'Run All Tests', 'Debug Test', 'Debug All Tests']);
        }
    });

    test("Returns no test code lenses when 'dotnet.testsCodeLens.enabled' option is set to false", async function () {
        const csharpConfig = vscode.workspace.getConfiguration('dotnet');
        await csharpConfig.update('codeLens.enableReferencesCodeLens', true);
        await csharpConfig.update('codeLens.enableTestsCodeLens', false);

        const codeLenses = await GetCodeLenses(fileUri, 100);
        expect(codeLenses.length).to.equal(2);

        for (const codeLens of codeLenses) {
            expect(codeLens.isResolved).to.be.true;
            isNotNull(codeLens.command);
            expect(codeLens.command.command).to.be.equal('editor.action.showReferences');
            expect(codeLens.command.title).to.equal('0 references');
        }
    });

    test("Returns no code lenses when 'dotnet.codeLens.enableReferencesCodeLens' and 'dotnet.codeLens.enableTestsCodeLens' options are set to false", async function () {
        const csharpConfig = vscode.workspace.getConfiguration('dotnet');
        await csharpConfig.update('codeLens.enableReferencesCodeLens', false);
        await csharpConfig.update('codeLens.enableTestsCodeLens', false);

        const codeLenses = await GetCodeLenses(fileUri, 100);
        expect(codeLenses.length).to.equal(0);
    });
});

async function GetCodeLenses(fileUri: vscode.Uri, resolvedItemCount?: number) {
    return <vscode.CodeLens[]>(
        await vscode.commands.executeCommand('vscode.executeCodeLensProvider', fileUri, resolvedItemCount)
    );
}

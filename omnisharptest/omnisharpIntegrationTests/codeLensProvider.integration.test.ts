/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import * as path from 'path';
import { activateCSharpExtension, describeIfSlnWithCsProj, describeIfNotGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { isNotNull } from '../testUtil';

describeIfNotGenerator(`CodeLensProvider: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    beforeAll(async function () {
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

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Returns all code lenses', async function () {
        const codeLenses = await GetCodeLenses(fileUri);
        expect(codeLenses.length).toEqual(2);

        for (const codeLens of codeLenses) {
            expect(codeLens.isResolved).toBe(false);
            expect(codeLens.command).toBe(undefined);
        }
    });

    test('Returns all resolved code lenses', async function () {
        const codeLenses = await GetCodeLenses(fileUri, 100);
        expect(codeLenses.length).toEqual(2);

        for (const codeLens of codeLenses) {
            expect(codeLens.isResolved).toBe(true);
            isNotNull(codeLens.command);
            expect(codeLens.command.title).toEqual('0 references');
        }
    });
});

// These tests only run on the slnWithCsproj solution
describeIfSlnWithCsProj(`CodeLensProvider options: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restoreAndWait(activation);

        const fileName = 'UnitTest1.cs';
        const projectDirectory = testAssetWorkspace.projects[2].projectDirectoryPath;
        const filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);

        await vscode.commands.executeCommand('vscode.open', fileUri);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    /* Skip this test until we are able to understand the cause of flakiness */
    test.skip("Returns no references code lenses when 'dotnet.codeLens.enableReferencesCodeLens' option is set to false", async function () {
        const csharpConfig = vscode.workspace.getConfiguration('dotnet');
        await csharpConfig.update('codeLens.enableReferencesCodeLens', false);
        await csharpConfig.update('codeLens.enableTestsCodeLens', true);

        const codeLenses = await GetCodeLenses(fileUri, 100);
        expect(codeLenses.length).toEqual(4);

        for (const codeLens of codeLenses) {
            expect(codeLens.isResolved).toBe(true);
            isNotNull(codeLens.command);
            expect([
                'dotnet.test.run',
                'dotnet.classTests.run',
                'dotnet.test.debug',
                'dotnet.classTests.debug',
            ]).toContain(codeLens.command.command);
            expect(['Run Test', 'Run All Tests', 'Debug Test', 'Debug All Tests']).toContain(codeLens.command.title);
        }
    });

    test("Returns no test code lenses when 'dotnet.testsCodeLens.enabled' option is set to false", async function () {
        const csharpConfig = vscode.workspace.getConfiguration('dotnet');
        await csharpConfig.update('codeLens.enableReferencesCodeLens', true);
        await csharpConfig.update('codeLens.enableTestsCodeLens', false);

        const codeLenses = await GetCodeLenses(fileUri, 100);
        expect(codeLenses.length).toEqual(3);

        for (const codeLens of codeLenses) {
            expect(codeLens.isResolved).toBe(true);
            isNotNull(codeLens.command);
            expect(codeLens.command.command).toEqual('editor.action.showReferences');
            expect(codeLens.command.title).toEqual('0 references');
        }
    });

    test("Returns no code lenses when 'dotnet.codeLens.enableReferencesCodeLens' and 'dotnet.codeLens.enableTestsCodeLens' options are set to false", async function () {
        const csharpConfig = vscode.workspace.getConfiguration('dotnet');
        await csharpConfig.update('codeLens.enableReferencesCodeLens', false);
        await csharpConfig.update('codeLens.enableTestsCodeLens', false);

        const codeLenses = await GetCodeLenses(fileUri, 100);
        expect(codeLenses.length).toEqual(0);
    });
});

async function GetCodeLenses(fileUri: vscode.Uri, resolvedItemCount?: number) {
    return <vscode.CodeLens[]>(
        await vscode.commands.executeCommand('vscode.executeCodeLensProvider', fileUri, resolvedItemCount)
    );
}

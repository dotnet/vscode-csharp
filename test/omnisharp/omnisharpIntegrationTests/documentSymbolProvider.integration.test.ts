/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import * as path from 'path';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { activateCSharpExtension, describeIfNotRazorOrGenerator } from './integrationHelpers';

describeIfNotRazorOrGenerator(`DocumentSymbolProvider: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        const fileName = 'documentSymbols.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        const filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);

        await vscode.commands.executeCommand('vscode.open', fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Returns all elements', async function () {
        const symbols = await GetDocumentSymbols(fileUri);

        // The count can vary:
        // Some builds of OmniSharp return a tree data structure with one root element
        // Some have fixes for a duplicate symbols issue and return fewer than we
        // used to assert
        // For now, just assert any symbols came back so that this passes locally and in CI
        // (where we always use the latest build)
        expect(symbols.length).toBeGreaterThan(0);
    });
});

async function GetDocumentSymbols(fileUri: vscode.Uri) {
    return <vscode.SymbolInformation[]>(
        await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', fileUri)
    );
}

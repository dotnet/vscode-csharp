/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as jestLib from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from './integrationHelpers';

jestLib.describe(`Razor Formatting ${testAssetWorkspace.description}`, function () {
    jestLib.beforeAll(async function () {
        const editorConfig = vscode.workspace.getConfiguration('razor');
        await editorConfig.update('format.enable', true);

        await integrationHelpers.openFileInWorkspaceAsync(path.join('Pages', 'BadlyFormatted.razor'));
        await integrationHelpers.activateCSharpExtension();
    });

    jestLib.afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    jestLib.test('Document formatted correctly', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const activeDocument = vscode.window.activeTextEditor?.document.uri;
        if (!activeDocument) {
            throw new Error('No active document');
        }
        const edits: vscode.TextEdit[] = await vscode.commands.executeCommand(
            'vscode.executeFormatDocumentProvider',
            activeDocument
        );

        jestLib.expect(edits).toHaveLength(6);
    });
});

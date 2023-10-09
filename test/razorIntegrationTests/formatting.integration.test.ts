/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as jestLib from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from '../integrationTests/integrationHelpers';

jestLib.describe(`Razor Formatting ${testAssetWorkspace.description}`, function () {
    jestLib.beforeAll(async function () {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const razorConfig = vscode.workspace.getConfiguration('razor');
        await razorConfig.update('format.enable', true);
        const htmlConfig = vscode.workspace.getConfiguration('html');
        await htmlConfig.update('format.enable', true);

        await integrationHelpers.activateCSharpExtension();
        await integrationHelpers.openFileInWorkspaceAsync(path.join('Pages', 'BadlyFormatted.razor'));
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

        const edits = <vscode.TextEdit[]>await vscode.commands.executeCommand(
            'vscode.executeFormatDocumentProvider',
            activeDocument,
            {
                insertSpaces: true,
                tabSize: 4,
            }
        );

        jestLib.expect(edits).toBeDefined();

        // It's much easier to verify the expected state of the document, than a bunch of edits
        const formatEdit = new vscode.WorkspaceEdit();
        formatEdit.set(activeDocument, edits);
        await vscode.workspace.applyEdit(formatEdit);

        const contents = vscode.window.activeTextEditor?.document.getText();
        jestLib.expect(contents).toEqual(`@page "/bad"

@code {
    private string _x = "";

    private void M()
    {
        // hi there
    }
}
`);
    });
});

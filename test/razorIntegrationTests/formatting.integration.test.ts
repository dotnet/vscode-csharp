/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from '../integrationTests/integrationHelpers';

function normalizeNewlines(original: string | undefined): string | undefined {
    if (!original) {
        return original;
    }

    while (original.indexOf('\r\n') != -1) {
        original = original.replace('\r\n', '\n');
    }

    return original;
}

describe(`Razor Formatting ${testAssetWorkspace.description}`, function () {
    beforeAll(async function () {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const razorConfig = vscode.workspace.getConfiguration('razor');
        await razorConfig.update('format.enable', true);
        const htmlConfig = vscode.workspace.getConfiguration('html');
        await htmlConfig.update('format.enable', true);

        await integrationHelpers.openFileInWorkspaceAsync(path.join('Pages', 'BadlyFormatted.razor'));
        await integrationHelpers.activateCSharpExtension();
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Document formatted correctly', async () => {
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

        expect(edits).toBeDefined();

        console.log(`Got ${edits.length} edits`);

        // It's much easier to verify the expected state of the document, than a bunch of edits
        const formatEdit = new vscode.WorkspaceEdit();
        formatEdit.set(activeDocument, edits);

        console.log(`Applying edit ${formatEdit}`);

        await vscode.workspace.applyEdit(formatEdit);

        const contents = normalizeNewlines(vscode.window.activeTextEditor?.document.getText());

        console.log(`Checking document contents...`);

        expect(contents).toBe(
            normalizeNewlines(`@page "/bad"

@code {
    private string _x = "";

    private void M()
    {
        // hi there
    }
}
`)
        );
    });
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { describe, beforeAll, afterAll, test, expect, beforeEach } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from '../../lsptoolshost/integrationTests/integrationHelpers';

describe(`Razor Rename ${testAssetWorkspace.description}`, function () {
    beforeAll(async function () {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        await integrationHelpers.activateCSharpExtension();
    });

    beforeEach(async function () {
        await integrationHelpers.openFileInWorkspaceAsync(path.join('Pages', 'Counter.razor'));
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Local Variable', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const activeDocument = vscode.window.activeTextEditor?.document.uri;
        if (!activeDocument) {
            throw new Error('No active document');
        }

        const workspaceEdit = <vscode.WorkspaceEdit>(
            await vscode.commands.executeCommand(
                'vscode.executeDocumentRenameProvider',
                activeDocument,
                new vscode.Position(11, 20),
                'newName'
            )
        );

        expect(workspaceEdit).toBeDefined();

        const entries = workspaceEdit.entries();
        expect(entries.length).toBe(1);

        const [uri, edits] = entries[0];
        expect(uri.path).toStrictEqual(activeDocument.path);
        expect(edits.length).toBe(3);

        const edit1 = edits[0];
        expect(edit1.range).toStrictEqual(new vscode.Range(new vscode.Position(6, 33), new vscode.Position(6, 45)));
        expect(edit1.newText).toBe('newName');

        const edit2 = edits[1];
        expect(edit2.range).toStrictEqual(new vscode.Range(new vscode.Position(11, 16), new vscode.Position(11, 28)));
        expect(edit2.newText).toBe('newName');

        const edit3 = edits[2];
        expect(edit3.range).toStrictEqual(new vscode.Range(new vscode.Position(15, 8), new vscode.Position(15, 20)));
        expect(edit3.newText).toBe('newName');
    });
});

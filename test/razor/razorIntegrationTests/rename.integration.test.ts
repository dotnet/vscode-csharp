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
                'message2'
            )
        );

        expect(workspaceEdit).toBeDefined();

        const entries = workspaceEdit.entries();
        expect(entries.length).toBe(1);

        const [uri1, edits] = entries[0];
        expect(uri1).toStrictEqual(activeDocument);
        expect(edits.length).toBe(3);

        const edit1 = edits[0];
        expect(edit1.range).toStrictEqual(new vscode.Range(new vscode.Position(3, 15), new vscode.Position(3, 15)));
        expect(edit1.newText).toBe('2');

        const edit2 = edits[1];
        expect(edit2.range).toStrictEqual(new vscode.Range(new vscode.Position(6, 13), new vscode.Position(6, 13)));
        expect(edit2.newText).toBe('2');
    });
});

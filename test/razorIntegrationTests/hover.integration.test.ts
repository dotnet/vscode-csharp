/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from '../integrationTests/integrationHelpers';

describe(`Razor Hover ${testAssetWorkspace.description}`, function () {
    beforeAll(async function () {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        await integrationHelpers.openFileInWorkspaceAsync(path.join('Pages', 'Index.cshtml'));
        await integrationHelpers.activateCSharpExtension();
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Tag Helper Hover', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const activeDocument = vscode.window.activeTextEditor?.document.uri;
        if (!activeDocument) {
            throw new Error('No active document');
        }

        const hover = <vscode.Hover[]>await vscode.commands.executeCommand(
            'vscode.executeHoverProvider',
            activeDocument,
            {
                line: 7,
                character: 2,
            }
        );

        expect(hover).toBeDefined();

        expect(hover.length).toBe(1);
        const first = hover[0];
        const answer =
            'The input element represents a typed data field, usually with a form control to allow the user to edit the data.';
        expect((<{ language: string; value: string }>first.contents[0]).value).toContain(answer);
    });
});

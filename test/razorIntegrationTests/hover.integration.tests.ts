/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as jestLib from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from '../integrationTests/integrationHelpers';

jestLib.describe(`Razor Hover ${testAssetWorkspace.description}`, function () {
    jestLib.beforeAll(async function () {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        await integrationHelpers.openFileInWorkspaceAsync(path.join('Pages', 'Index.cshtml'));
        await integrationHelpers.activateCSharpExtension();
    });

    jestLib.afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    jestLib.test('Tag Helper Hover', async () => {
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
                line: 8,
                character: 2,
            }
        );

        jestLib.expect(hover).toBeDefined();

        jestLib.expect(hover.length).toBe(1);
        const first = hover[0];
        jestLib.expect(first.contents).toContain('input');
    });
});

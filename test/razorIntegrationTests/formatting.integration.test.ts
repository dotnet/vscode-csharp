/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from '../integrationTests/integrationHelpers';

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

        expect(edits).toHaveLength(13);

        assertEditEqual(edits[0], 3, 0, 3, 0, '    ');
        assertEditEqual(edits[1], 3, 7, 3, 17, '');
        assertEditEqual(edits[2], 3, 18, 3, 31, '');
        assertEditEqual(edits[3], 3, 37, 3, 38, '');
        assertEditEqual(edits[4], 3, 39, 3, 57, '');
        assertEditEqual(edits[5], 3, 59, 3, 69, '');
        assertEditEqual(edits[6], 3, 70, 3, 86, '');
        assertEditEqual(edits[7], 3, 87, 3, 99, '');
        assertEditEqual(edits[8], 3, 100, 3, 108, '');
        assertEditEqual(edits[9], 5, 0, 5, 0, '    ');
        assertEditEqual(edits[10], 6, 0, 6, 0, '    ');
        assertEditEqual(edits[11], 7, 0, 7, 0, '        ');
        assertEditEqual(edits[12], 8, 0, 8, 0, '    ');

        function assertEditEqual(
            actual: vscode.TextEdit,
            startLine: number,
            startChar: number,
            endLine: number,
            endChar: number,
            text: string
        ) {
            expect(actual.newText).toBe(text);
            expect(actual.range.start.line).toBe(startLine);
            expect(actual.range.start.character).toBe(startChar);
            expect(actual.range.end.line).toBe(endLine);
            expect(actual.range.end.character).toBe(endChar);
        }
    });
});

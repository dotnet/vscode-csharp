/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { describe, beforeAll, beforeEach, afterAll, test, expect } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from '../integrationTests/integrationHelpers';
import { getCompletionsAsync } from '../integrationTests/completionHelpers';

describe(`Razor Completion ${testAssetWorkspace.description}`, function () {
    beforeAll(async function () {
        //await integrationHelpers.activateCSharpExtension();

        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }
    });

    beforeEach(async function () {
        const fileName = path.join('Pages', 'CompletionTest.razor');
        await integrationHelpers.openFileInWorkspaceAsync(fileName);
    });

    afterAll(async () => {
        //await testAssetWorkspace.cleanupWorkspace();
    });

    test('Completion end-to-end', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const activeDocument = vscode.window.activeTextEditor?.document.uri;
        if (!activeDocument) {
            throw new Error('No active document');
        }

        const activeEditor = vscode.window.activeTextEditor;
        await activeEditor?.edit((e) => {
            e.insert(new vscode.Position(0, 0), '<span></span>');
        });

        await waitForExpectedCompletionLabels(new vscode.Position(0, 1), undefined, 10, 'div', 'CompletionTest');
    }, 300000);

    async function waitForExpectedCompletionLabels(
        position: vscode.Position,
        triggerCharacter: string | undefined,
        resolvedItemCount: number,
        ...labels: string[]
    ): Promise<void> {
        const duration = 30 * 1000;
        const step = 500;
        await integrationHelpers.waitForExpectedResult<vscode.CompletionList>(
            async () => {
                const completions = await getCompletionsAsync(position, triggerCharacter, resolvedItemCount);
                return completions;
            },
            duration,
            step,
            // See https://jestjs.io/docs/expect#expectarraycontainingarray for arrayContaining syntax explanation
            (completions) => expect(completions.items.map((item) => item.label)).toEqual(expect.arrayContaining(labels))
        );
    }
});

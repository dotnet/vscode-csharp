/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import {
    activateCSharpExtension,
    closeAllEditorsAsync,
    getCompletionsAsync,
    openFileInWorkspaceAsync,
    revertActiveFile,
    waitForAllAsyncOperationsAsync,
    waitForExpectedResult,
    describeIfFileBasedPrograms,
} from './integrationHelpers';
import { beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';
import { CSharpExtensionExports } from '../../../src/csharpExtensionExports';

describeIfFileBasedPrograms(`File-based Programs Tests`, () => {
    let exports: CSharpExtensionExports;

    beforeAll(async () => {
        process.env.RoslynWaiterEnabled = 'true';
        exports = await activateCSharpExtension();
    });

    beforeEach(async () => {
        await openFileInWorkspaceAsync(path.join('src', 'scripts', 'app1.cs'));
    });

    afterEach(async () => {
        await revertActiveFile();
        await closeAllEditorsAsync();
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Inserting package directive triggers a restore', async () => {
        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(new vscode.Position(0, 0), '#:package Newtonsoft.Json@13.0.3');
            editBuilder.insert(new vscode.Position(1, 0), 'using Newton');
        });
        await vscode.window.activeTextEditor!.document.save();
        await waitForAllAsyncOperationsAsync(exports);

        const position = new vscode.Position(1, 'using Newton'.length);
        await waitForExpectedResult<vscode.CompletionList>(
            async () => getCompletionsAsync(position, undefined, 10),
            10 * 1000,
            100,
            (completionItems) => expect(completionItems.items.map((item) => item.label)).toContain('Newtonsoft')
        );
    });
});

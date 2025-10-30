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
    sleep,
    waitForAllAsyncOperationsAsync,
    waitForExpectedResult,
} from './integrationHelpers';
import { describe, beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';
import { CSharpExtensionExports } from '../../../src/csharpExtensionExports';

const doRunSuite = process.env['ROSLYN_SKIP_TEST_FILE_BASED_PROGRAMS'] !== 'true';
console.log(`process.env.ROSLYN_SKIP_TEST_FILE_BASED_PROGRAMS: ${process.env.ROSLYN_SKIP_TEST_FILE_BASED_PROGRAMS}`);
console.log(`doRunSuite: ${doRunSuite}`);
(doRunSuite ? describe : describe.skip)(`File-based Programs Tests`, () => {
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
        await sleep(1);
        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(new vscode.Position(0, 0), '#:package Newtonsoft.Json@13.0.3');
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

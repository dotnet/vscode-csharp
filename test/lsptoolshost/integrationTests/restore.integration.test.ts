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
    waitForExpectedResult,
} from './integrationHelpers';
import { describe, beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';
import { CSharpExtensionExports } from '../../../src/csharpExtensionExports';

const timeout = 15*60*1000;

describe(`Restore Tests`, () => {
    let exports: CSharpExtensionExports;

    beforeAll(async () => {
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

        let designTimeBuildFinished = false;
        exports.experimental.languageServerEvents.onProjectsRestored(() => {
            // Restore has finished. Now subscribe to the next design time build.
            // TODO: seems racy.
            exports.experimental.languageServerEvents.onProjectReloadCompleted(() => {
                designTimeBuildFinished = true;
            });
        });

        await waitForExpectedResult<boolean>(
            () => designTimeBuildFinished,
            timeout,
            100,
            (designTimeBuildFinished) => expect(designTimeBuildFinished).toBe(true)
        );

        // we restored, then completed a design-time build.
        const completionItems = await getCompletionsAsync(new vscode.Position(1, "using Newton".length), undefined, 10);

        expect(completionItems.items.map(item => item.label)).toContain("Newtonsoft");
    }, timeout);
});

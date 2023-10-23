/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'async-file';
import * as vscode from 'vscode';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { poll } from './poll';
import { isNotNull } from '../testUtil';

// Consistently failing in CI: https://github.com/OmniSharp/omnisharp-vscode/issues/4646
describe.skip(`Tasks generation: ${testAssetWorkspace.description}`, function () {
    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restoreAndWait(activation);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Starting .NET Core Launch (console) from the workspace root should create an Active Debug Session', async () => {
        vscode.commands.executeCommand('dotnet.generateAssets', 0);
        await poll(async () => fs.exists(testAssetWorkspace.launchJsonPath), 10000, 100);

        const onChangeSubscription = vscode.debug.onDidChangeActiveDebugSession((_) => {
            onChangeSubscription.dispose();
            isNotNull(vscode.debug.activeDebugSession);
            expect(vscode.debug.activeDebugSession.type).toEqual('coreclr');
        });

        const result = await vscode.debug.startDebugging(
            vscode.workspace.workspaceFolders![0],
            '.NET Core Launch (console)'
        );
        expect(result).toEqual('Debugger could not be started.');

        const debugSessionTerminated = new Promise<void>((resolve) => {
            const onTerminateSubscription = vscode.debug.onDidTerminateDebugSession((_) => {
                onTerminateSubscription.dispose();
                resolve();
            });
        });

        await debugSessionTerminated;
    });
});

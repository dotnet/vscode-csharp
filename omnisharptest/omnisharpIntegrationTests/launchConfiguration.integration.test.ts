/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as vscode from 'vscode';

import { should, expect } from 'chai';
import { activateCSharpExtension, isRazorWorkspace, isSlnWithGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { poll } from './poll';
import { isNotNull } from '../testUtil';

suite(`Tasks generation: ${testAssetWorkspace.description}`, function () {
    suiteSetup(async function () {
        should();

        // Consistently failing in CI: https://github.com/OmniSharp/omnisharp-vscode/issues/4646
        this.skip();

        if (isRazorWorkspace(vscode.workspace) || isSlnWithGenerator(vscode.workspace)) {
            this.skip();
        }

        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restoreAndWait(activation);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Starting .NET Core Launch (console) from the workspace root should create an Active Debug Session', async () => {
        vscode.commands.executeCommand('dotnet.generateAssets', 0);
        await poll(async () => fs.exists(testAssetWorkspace.launchJsonPath), 10000, 100);

        const onChangeSubscription = vscode.debug.onDidChangeActiveDebugSession((_) => {
            onChangeSubscription.dispose();
            isNotNull(vscode.debug.activeDebugSession);
            expect(vscode.debug.activeDebugSession.type).to.equal('coreclr');
        });

        const result = await vscode.debug.startDebugging(
            vscode.workspace.workspaceFolders![0],
            '.NET Core Launch (console)'
        );
        expect(result, 'Debugger could not be started.');

        const debugSessionTerminated = new Promise<void>((resolve) => {
            const onTerminateSubscription = vscode.debug.onDidTerminateDebugSession((_) => {
                onTerminateSubscription.dispose();
                resolve();
            });
        });

        await debugSessionTerminated;
    });
});

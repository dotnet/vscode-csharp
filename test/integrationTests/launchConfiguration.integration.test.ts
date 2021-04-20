/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as vscode from 'vscode';

import { should, expect } from 'chai';
import { activateCSharpExtension, isRazorWorkspace } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { poll } from './poll';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`Tasks generation: ${testAssetWorkspace.description}`, function () {
    suiteSetup(async function () {
        should();

        // These tests don't run on the BasicRazorApp2_1 solution
        if (isRazorWorkspace(vscode.workspace)) {
            this.skip();
        }

        await activateCSharpExtension();
        await testAssetWorkspace.restore();

        await vscode.commands.executeCommand("dotnet.generateAssets", 0);

        await poll(async () => await fs.exists(testAssetWorkspace.launchJsonPath), 10000, 100);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Starting .NET Core Launch (console) from the workspace root should create an Active Debug Session", async () => {

        const onChangeSubscription = vscode.debug.onDidChangeActiveDebugSession((e) => {
            onChangeSubscription.dispose();
            expect(vscode.debug.activeDebugSession).not.to.be.undefined;
            expect(vscode.debug.activeDebugSession.type).to.equal("coreclr");
        });

        let result = await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], ".NET Core Launch (console)");
        expect(result, "Debugger could not be started.");

        let debugSessionTerminated = new Promise<void>(resolve => {
            const onTerminateSubscription = vscode.debug.onDidTerminateDebugSession((e) => {
                onTerminateSubscription.dispose();
                resolve();
            });
        });

        await debugSessionTerminated;
    });
});
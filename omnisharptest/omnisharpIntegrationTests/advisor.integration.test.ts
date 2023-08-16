/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { expect, should } from 'chai';
import * as path from 'path';
import { activateCSharpExtension, isRazorWorkspace, isSlnWithGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';

import { Advisor } from '../../src/features/diagnosticsProvider';

function setLimit(to: number | null) {
    const csharpConfig = vscode.workspace.getConfiguration('csharp');
    return csharpConfig.update('maxProjectFileCountForDiagnosticAnalysis', to);
}

suite(`Advisor ${testAssetWorkspace.description}`, function () {
    let advisor: Advisor;

    suiteSetup(async function () {
        should();

        if (isRazorWorkspace(vscode.workspace) || isSlnWithGenerator(vscode.workspace)) {
            this.skip();
        }

        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        advisor = activation.advisor;

        const fileName = 'completion.cs';
        const dir = testAssetWorkspace.projects[0].projectDirectoryPath;
        const fileUri = vscode.Uri.file(path.join(dir, fileName));
        await vscode.commands.executeCommand('vscode.open', fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Advisor.shouldValidateAll returns true when maxProjectFileCountForDiagnosticAnalysis is higher than the file count', async () => {
        await setLimit(1000);

        expect(advisor.shouldValidateAll()).to.be.true;
    });

    test('Advisor.shouldValidateFiles returns true when maxProjectFileCountForDiagnosticAnalysis is higher than the file count', async () => {
        await setLimit(1000);

        expect(advisor.shouldValidateFiles()).to.be.true;
    });

    test('Advisor.shouldValidateAll returns false when maxProjectFileCountForDiagnosticAnalysis is lower than the file count', async () => {
        await setLimit(1);

        expect(advisor.shouldValidateAll()).to.be.false;
    });

    test('Advisor.shouldValidateFiles returns true when maxProjectFileCountForDiagnosticAnalysis is lower than the file count', async () => {
        await setLimit(1);

        expect(advisor.shouldValidateFiles()).to.be.true;
    });

    test('Advisor.shouldValidateAll returns true when maxProjectFileCountForDiagnosticAnalysis is null', async () => {
        await setLimit(null);

        expect(advisor.shouldValidateAll()).to.be.true;
    });

    test('Advisor.shouldValidateFiles returns true when maxProjectFileCountForDiagnosticAnalysis is null', async () => {
        await setLimit(null);

        expect(advisor.shouldValidateFiles()).to.be.true;
    });
});
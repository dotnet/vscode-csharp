/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { expect } from 'chai';
import * as path from 'path';
import { activateCSharpExtension, isRazorWorkspace } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';

import { Advisor } from '../../src/features/diagnosticsProvider';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

function setLimit(to: number | null) {
    let csharpConfig = vscode.workspace.getConfiguration('csharp');
    return csharpConfig.update('maxProjectFileCountForDiagnosticAnalysis', to);
}

suite(`Advisor ${testAssetWorkspace.description}`, function () {
    let advisor: Advisor;

    suiteSetup(async function () {
        // These tests don't run on the BasicRazorApp2_1 solution
        if (isRazorWorkspace(vscode.workspace)) {
            this.skip();
        }

        let activationResult = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        if (!activationResult) {
            throw new Error('Cannot activate extension.');
        } else {
            advisor = activationResult.advisor;
        }

        let fileName = 'completion.cs';
        let dir = testAssetWorkspace.projects[0].projectDirectoryPath;
        let fileUri = vscode.Uri.file(path.join(dir, fileName));
        await vscode.commands.executeCommand('vscode.open', fileUri);
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
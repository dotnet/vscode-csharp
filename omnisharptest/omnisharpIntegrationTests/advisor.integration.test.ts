/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { activateCSharpExtension, describeIfNotRazorOrGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';

import { Advisor } from '../../src/features/diagnosticsProvider';

function setLimit(to: number | null) {
    const csharpConfig = vscode.workspace.getConfiguration('csharp');
    return csharpConfig.update('maxProjectFileCountForDiagnosticAnalysis', to);
}

describeIfNotRazorOrGenerator(`Advisor ${testAssetWorkspace.description}`, function () {
    let advisor: Advisor;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        advisor = activation.advisor;

        const fileName = 'completion.cs';
        const dir = testAssetWorkspace.projects[0].projectDirectoryPath;
        const fileUri = vscode.Uri.file(path.join(dir, fileName));
        await vscode.commands.executeCommand('vscode.open', fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Advisor.shouldValidateAll returns true when maxProjectFileCountForDiagnosticAnalysis is higher than the file count', async () => {
        await setLimit(1000);

        expect(advisor.shouldValidateAll()).toBe(true);
    });

    test('Advisor.shouldValidateFiles returns true when maxProjectFileCountForDiagnosticAnalysis is higher than the file count', async () => {
        await setLimit(1000);

        expect(advisor.shouldValidateFiles()).toBe(true);
    });

    test('Advisor.shouldValidateAll returns false when maxProjectFileCountForDiagnosticAnalysis is lower than the file count', async () => {
        await setLimit(1);

        expect(advisor.shouldValidateAll()).toBe(false);
    });

    test('Advisor.shouldValidateFiles returns true when maxProjectFileCountForDiagnosticAnalysis is lower than the file count', async () => {
        await setLimit(1);

        expect(advisor.shouldValidateFiles()).toBe(true);
    });

    test('Advisor.shouldValidateAll returns true when maxProjectFileCountForDiagnosticAnalysis is null', async () => {
        await setLimit(null);

        expect(advisor.shouldValidateAll()).toBe(true);
    });

    test('Advisor.shouldValidateFiles returns true when maxProjectFileCountForDiagnosticAnalysis is null', async () => {
        await setLimit(null);

        expect(advisor.shouldValidateFiles()).toBe(true);
    });
});

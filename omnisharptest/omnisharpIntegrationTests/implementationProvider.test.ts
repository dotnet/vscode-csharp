/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import OmniSharpImplementationProvider from '../../src/omnisharp/features/implementationProvider';
import * as path from 'path';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { activateCSharpExtension, describeIfNotRazorOrGenerator } from './integrationHelpers';

describeIfNotRazorOrGenerator(`${OmniSharpImplementationProvider.name}: ${testAssetWorkspace.description}`, () => {
    let fileUri: vscode.Uri;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        const fileName = 'implementation.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        await vscode.commands.executeCommand('vscode.open', fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Returns the implementation', async () => {
        const implementationList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeImplementationProvider',
                fileUri,
                new vscode.Position(4, 22)
            )
        );
        expect(implementationList.length).toEqual(2);
    });
});

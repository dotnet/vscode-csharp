/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import OmniSharpReferenceProvider from '../../../src/omnisharp/features/referenceProvider';
import * as path from 'path';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { activateCSharpExtension, describeIfNotRazorOrGenerator } from './integrationHelpers';

describeIfNotRazorOrGenerator(`${OmniSharpReferenceProvider.name}: ${testAssetWorkspace.description}`, () => {
    let fileUri: vscode.Uri;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        const fileName = 'reference.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        await vscode.commands.executeCommand('vscode.open', fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Returns the reference without declaration', async () => {
        const referenceList = <vscode.Location[]>(
            await vscode.commands.executeCommand('vscode.executeReferenceProvider', fileUri, new vscode.Position(6, 22))
        );
        expect(referenceList.length).toEqual(1);
        expect(referenceList[0].range.start.line).toEqual(13);
    });
});

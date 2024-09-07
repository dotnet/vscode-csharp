/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import OmniSharpDefinitionProvider from '../../../src/omnisharp/features/definitionProvider';
import * as path from 'path';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { activateCSharpExtension, describeIfNotRazorOrGenerator, restartOmniSharpServer } from './integrationHelpers';

describeIfNotRazorOrGenerator(`${OmniSharpDefinitionProvider.name}: ${testAssetWorkspace.description}`, () => {
    let fileUri: vscode.Uri;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        const fileName = 'typeDefinition.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        await vscode.commands.executeCommand('vscode.open', fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Returns the type definition', async () => {
        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeTypeDefinitionProvider',
                fileUri,
                new vscode.Position(9, 18)
            )
        );
        expect(definitionList.length).toEqual(1);
        expect(definitionList[0]).toBeDefined();
        expect(definitionList[0].uri.path).toContain('typeDefinition.cs');
    });

    test('Returns the definition from Metadata', async () => {
        const omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        await omnisharpConfig.update('enableDecompilationSupport', false, vscode.ConfigurationTarget.Global);
        await restartOmniSharpServer();

        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeTypeDefinitionProvider',
                fileUri,
                new vscode.Position(10, 18)
            )
        );
        expect(definitionList.length).toEqual(1);
        expect(definitionList[0]).toBeDefined();
        expect(definitionList[0].uri.path).toContain('[metadata] String.cs');
    });

    test('Returns multiple definitions for partial types', async () => {
        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeTypeDefinitionProvider',
                fileUri,
                new vscode.Position(11, 18)
            )
        );
        expect(definitionList.length).toEqual(2);
        expect(definitionList[0]).toBeDefined;
        expect(definitionList[0].uri.path).toContain('typeDefinition.cs');
        expect(definitionList[1]).toBeDefined;
        expect(definitionList[1].uri.path).toContain('typeDefinition.cs');
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });
});

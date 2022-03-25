/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { should, assert } from 'chai';
import { activateCSharpExtension, isRazorWorkspace, isSlnWithGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as path from 'path';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`Inlay Hints ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        if (isRazorWorkspace(vscode.workspace) || isSlnWithGenerator(vscode.workspace)) {
            this.skip();
        }

        const csharpConfig = vscode.workspace.getConfiguration('csharp');
        csharpConfig.update('inlayhints.parameters.enabled', true);
        csharpConfig.update('inlayhints.parameters.forLiteralParameters', true);
        csharpConfig.update('inlayhints.parameters.forObjectCreationParameters', true);
        csharpConfig.update('inlayhints.parameters.forIndexerParameters', true);
        csharpConfig.update('inlayhints.parameters.forOtherParameters', true);
        csharpConfig.update('inlayhints.parameters.suppressForParametersThatDifferOnlyBySuffix', true);
        csharpConfig.update('inlayhints.parameters.suppressForParametersThatMatchMethodIntent', true);
        csharpConfig.update('inlayhints.parameters.suppressForParametersThatMatchArgumentName', true);
        csharpConfig.update('inlayhints.types.enabled', true);
        csharpConfig.update('inlayhints.types.forImplicitVariableTypes', true);
        csharpConfig.update('inlayhints.types.forLambdaParameterTypes', true);
        csharpConfig.update('inlayhints.types.forImplicitObjectCreation', true);

        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restoreAndWait(activation);

        const fileName = 'inlayHints.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        const filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test.only("Hints retrieved for region", async () => {
        const range = new vscode.Range(new vscode.Position(4, 8), new vscode.Position(15, 85));
        const hints : vscode.InlayHint[] = await vscode.commands.executeCommand('vscode.executeInlayHintProvider', fileUri, range);
        assert.lengthOf(hints, 6);
        assertValues(hints[0], 'InlayHints ', 6, 12);
        assertValues(hints[1], ' InlayHints', 7, 27);
        assertValues(hints[2], 'string ', 8, 28);
        assertValues(hints[3], 'i: ', 9, 17);
        assertValues(hints[4], 'param1: ', 10, 15);
        assertValues(hints[5], 'param1: ', 11, 27);

        function assertValues(hint: vscode.InlayHint, expectedLabel: string, expectedLine: number, expectedCharacter: number) {
            assert.equal(hint.label, expectedLabel);
            assert.equal(hint.position.line, expectedLine);
            assert.equal(hint.position.character, expectedCharacter);
        }
    });
});

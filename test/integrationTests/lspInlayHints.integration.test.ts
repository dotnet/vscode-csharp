/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { should, assert } from 'chai';
import testAssetWorkspace from '../../omnisharptest/integrationTests/testAssets/testAssetWorkspace';
import * as path from 'path';
import { activateCSharpExtension, isRazorWorkspace, isSlnWithGenerator } from './integrationHelpers';
import { InlayHint, InlayHintKind, Position } from 'vscode-languageserver-protocol';

suite(`LSP Inlay Hints ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        if (isRazorWorkspace(vscode.workspace) || isSlnWithGenerator(vscode.workspace)) {
            this.skip();
        }

        const editorConfig = vscode.workspace.getConfiguration('editor');
        await editorConfig.update('inlayHints.enabled', true);
        const dotnetConfig = vscode.workspace.getConfiguration('dotnet');
        await dotnetConfig.update('inlayHints.enableInlayHintsForParameters', true);
        await dotnetConfig.update('inlayHints.enableInlayHintsForLiteralParameters', true);
        await dotnetConfig.update('inlayHints.enableInlayHintsForObjectCreationParameters', true);
        await dotnetConfig.update('inlayHints.enableInlayHintsForIndexerParameters', true);
        await dotnetConfig.update('inlayHints.enableInlayHintsForOtherParameters', true);
        await dotnetConfig.update('inlayHints.suppressInlayHintsForParametersThatDifferOnlyBySuffix', true);
        await dotnetConfig.update('inlayHints.suppressInlayHintsForParametersThatMatchMethodIntent', true);
        await dotnetConfig.update('inlayHints.suppressInlayHintsForParametersThatMatchArgumentName', true);

        const csharpConfig = vscode.workspace.getConfiguration('csharp');
        await csharpConfig.update('inlayHints.enableInlayHintsForTypes', true);
        await csharpConfig.update('inlayHints.enableInlayHintsForImplicitVariableTypes', true);
        await csharpConfig.update('inlayHints.enableInlayHintsForLambdaParameterTypes', true);
        await csharpConfig.update('inlayHints.enableInlayHintsForImplicitObjectCreation', true);

        const fileName = 'inlayHints.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        const filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);

        await vscode.commands.executeCommand('vscode.open', fileUri);
        await activateCSharpExtension();
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Hints retrieved for region', async () => {
        const range = new vscode.Range(new vscode.Position(4, 8), new vscode.Position(15, 85));
        const hints: vscode.InlayHint[] = await vscode.commands.executeCommand(
            'vscode.executeInlayHintProvider',
            fileUri,
            range
        );

        assert.lengthOf(hints, 5);

        assertInlayHintEqual(hints[0], InlayHint.create(Position.create(6, 12), 'InlayHints', InlayHintKind.Type));
        assertInlayHintEqual(hints[1], InlayHint.create(Position.create(7, 27), 'InlayHints', InlayHintKind.Type));
        assertInlayHintEqual(hints[2], InlayHint.create(Position.create(9, 17), 'i:', InlayHintKind.Parameter));
        assertInlayHintEqual(hints[3], InlayHint.create(Position.create(10, 15), 'param1:', InlayHintKind.Parameter));
        assertInlayHintEqual(hints[4], InlayHint.create(Position.create(11, 27), 'param1:', InlayHintKind.Parameter));

        function assertInlayHintEqual(actual: vscode.InlayHint, expected: InlayHint) {
            const actualLabel = actual.label as string;
            assert.equal(actualLabel, expected.label);
            assert.equal(actual.position.line, expected.position.line);
            assert.equal(actual.position.character, expected.position.character);
            assert.equal(actual.kind, expected.kind);
        }
    });
});

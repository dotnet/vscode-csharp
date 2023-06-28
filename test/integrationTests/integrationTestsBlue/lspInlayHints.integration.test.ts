/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { should, assert } from 'chai';
import testAssetWorkspace from '../testAssets/testAssetWorkspace';
import * as path from 'path';
import { activateCSharpExtensionNoOmnisharp, isRazorWorkspace, isSlnWithGenerator, restartRoslynLanguageServer } from './integrationHelpersBlue';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

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

        await restartRoslynLanguageServer();
        //await testAssetWorkspace.restore();

        const fileName = 'inlayHints.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        const filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);

        await vscode.commands.executeCommand("vscode.open", fileUri);
        await activateCSharpExtensionNoOmnisharp();
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Hints retrieved for region", async () => {
        const range = new vscode.Range(new vscode.Position(4, 8), new vscode.Position(15, 85));
        const hints: vscode.InlayHint[] = await vscode.commands.executeCommand('vscode.executeInlayHintProvider', fileUri, range);

        assert.lengthOf(hints, 6);

        /*
        assertInlayHintEqual(hints[0], { Label: 'InlayHints ', Position: { Line: 6, Column: 12 }, Data: {}, TextEdits: [{ StartLine: 6, StartColumn: 8, EndLine: 6, EndColumn: 11, NewText: 'InlayHints' }] });
        assertInlayHintEqual(hints[1], { Label: ' InlayHints', Position: { Line: 7, Column: 27 }, Data: {}, TextEdits: [{ StartLine: 7, StartColumn: 27, EndLine: 7, EndColumn: 27, NewText: ' InlayHints' }] });
        assertInlayHintEqual(hints[2], { Label: 'string ', Position: { Line: 8, Column: 28 }, Data: {}, TextEdits: [{ StartLine: 8, StartColumn: 28, EndLine: 8, EndColumn: 28, NewText: 'string ' }] });
        assertInlayHintEqual(hints[3], { Label: 'i: ', Position: { Line: 9, Column: 17 }, Data: {}, TextEdits: [{ StartLine: 9, StartColumn: 17, EndLine: 9, EndColumn: 17, NewText: 'i: ' }] });
        assertInlayHintEqual(hints[4], { Label: 'param1: ', Position: { Line: 10, Column: 15 }, Data: {}, TextEdits: [{ StartLine: 10, StartColumn: 15, EndLine: 10, EndColumn: 15, NewText: 'param1: ' }] });
        assertInlayHintEqual(hints[5], { Label: 'param1: ', Position: { Line: 11, Column: 27 }, Data: {}, TextEdits: [{ StartLine: 11, StartColumn: 27, EndLine: 11, EndColumn: 27, NewText: 'param1: ' }] });

        function assertInlayHintEqual(actual: vscode.InlayHint, expected: InlayHint) {
            assert.equal(actual.label, expected.Label);
            assert.equal(actual.position.line, expected.Position.Line);
            assert.equal(actual.position.character, expected.Position.Column);

            if (!actual.textEdits) {
                assert.isUndefined(expected.TextEdits);
                return;
            }

            isNotNull(expected.TextEdits);
            assert.equal(actual.textEdits.length, expected.TextEdits.length);
            for (let i = 0; i < actual.textEdits.length; i++) {
                const actualTextEdit = actual.textEdits[i];
                const expectedTextEdit = expected.TextEdits[i];

                assertTextEditEqual(actualTextEdit, expectedTextEdit);
            }
        }

        function assertTextEditEqual(actual: vscode.TextEdit, expected: LinePositionSpanTextChange) {
            assert.equal(actual.range.start.line, expected.StartLine);
            assert.equal(actual.range.start.character, expected.StartColumn);
            assert.equal(actual.range.end.line, expected.EndLine);
            assert.equal(actual.range.end.character, expected.EndColumn);
            assert.equal(actual.newText, expected.NewText);
        }
        */
    });
});

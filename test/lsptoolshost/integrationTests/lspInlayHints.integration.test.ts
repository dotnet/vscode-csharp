/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { describe, beforeAll, afterAll, test, expect, beforeEach, afterEach } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from './integrationHelpers';
import { InlayHint, InlayHintKind, Position } from 'vscode-languageserver-protocol';

describe(`Inlay Hints Tests`, () => {
    beforeAll(async () => {
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

        await integrationHelpers.activateCSharpExtension();
    });

    beforeEach(async () => {
        await integrationHelpers.openFileInWorkspaceAsync(path.join('src', 'app', 'inlayHints.cs'));
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await integrationHelpers.closeAllEditorsAsync();
    });

    test('Hints retrieved for region', async () => {
        const range = new vscode.Range(new vscode.Position(4, 8), new vscode.Position(15, 85));
        const activeDocument = vscode.window.activeTextEditor?.document.uri;
        if (!activeDocument) {
            throw new Error('No active document');
        }
        const hints: vscode.InlayHint[] = await vscode.commands.executeCommand(
            'vscode.executeInlayHintProvider',
            activeDocument,
            range
        );

        expect(hints).toHaveLength(6);

        assertInlayHintEqual(hints[0], InlayHint.create(Position.create(6, 12), 'InlayHints', InlayHintKind.Type));
        assertInlayHintEqual(hints[1], InlayHint.create(Position.create(7, 27), 'InlayHints', InlayHintKind.Type));
        assertInlayHintEqual(hints[2], InlayHint.create(Position.create(8, 28), 'string', InlayHintKind.Type));
        assertInlayHintEqual(hints[3], InlayHint.create(Position.create(9, 17), 'i:', InlayHintKind.Parameter));
        assertInlayHintEqual(hints[4], InlayHint.create(Position.create(10, 15), 'param1:', InlayHintKind.Parameter));
        assertInlayHintEqual(hints[5], InlayHint.create(Position.create(11, 27), 'param1:', InlayHintKind.Parameter));

        function assertInlayHintEqual(actual: vscode.InlayHint, expected: InlayHint) {
            const actualLabel = actual.label as string;
            expect(actualLabel).toBe(expected.label);
            expect(actual.position.line).toBe(expected.position.line);
            expect(actual.position.character).toBe(expected.position.character);
            expect(actual.kind).toBe(expected.kind);
        }
    });
});

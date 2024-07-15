/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { describe, beforeAll, beforeEach, afterAll, test, expect } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { activateCSharpExtension, openFileInWorkspaceAsync } from './integrationHelpers';
import { getCompletionsAsync } from './completionHelpers';

describe(`[${testAssetWorkspace.description}] Test Completion`, function () {
    beforeAll(async function () {
        await activateCSharpExtension();
    });

    beforeEach(async function () {
        const fileName = path.join('src', 'app', 'completion.cs');
        await openFileInWorkspaceAsync(fileName);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Returns completion items', async () => {
        const completionList = await getCompletionsAsync(new vscode.Position(8, 12), undefined, 10);
        expect(completionList.items.length).toBeGreaterThan(0);
        expect(completionList.items.map((item) => item.label)).toContain('Console');
    });

    test('Resolve adds documentation', async () => {
        const completionList = await getCompletionsAsync(new vscode.Position(8, 12), undefined, 10);
        const documentation = completionList.items.slice(0, 10).filter((item) => item.documentation);
        expect(documentation.length).toEqual(10);
    });

    test('Override completion is applied', async () => {
        const completionList = await getCompletionsAsync(new vscode.Position(12, 24), ' ', 10);
        expect(completionList.items.length).toBeGreaterThan(0);
        const methodOverrideItem = completionList.items.find(
            (item) => item.label === 'Method(singleCsproj2.NeedsImport n)'
        );

        if (!methodOverrideItem) {
            throw new Error(completionList.items.reduce((acc, item) => acc + item.label + '\n', ''));
        }

        expect(methodOverrideItem).toBeDefined();
        expect(methodOverrideItem!.kind).toEqual(vscode.CompletionItemKind.Method);
        expect(methodOverrideItem!.command).toBeDefined();
        expect(methodOverrideItem!.command!.command).toEqual('roslyn.client.completionComplexEdit');

        await vscode.commands.executeCommand(
            methodOverrideItem!.command!.command,
            methodOverrideItem!.command!.arguments![0],
            methodOverrideItem!.command!.arguments![1],
            methodOverrideItem!.command!.arguments![2],
            methodOverrideItem!.command!.arguments![3]
        );

        const usingLine = vscode.window.activeTextEditor!.document.lineAt(1).text;
        const methodOverrideLine = vscode.window.activeTextEditor!.document.lineAt(13).text;
        const methodOverrideImplLine = vscode.window.activeTextEditor!.document.lineAt(15).text;
        expect(usingLine).toContain('using singleCsproj2;');
        expect(methodOverrideLine).toContain('override void Method(NeedsImport n)');
        expect(methodOverrideImplLine).toContain('base.Method(n);');
    });
});

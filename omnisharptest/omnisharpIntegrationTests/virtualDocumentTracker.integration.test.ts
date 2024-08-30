/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import { activateCSharpExtension, describeIfNotGenerator, isSlnWithGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { IDisposable } from '../../src/disposable';

describeIfNotGenerator(`Virtual Document Tracking ${testAssetWorkspace.description}`, function () {
    const virtualScheme = 'virtual';
    let virtualDocumentRegistration: IDisposable;
    let virtualUri: vscode.Uri;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restoreAndWait(activation);

        const virtualCSharpDocumentProvider = new VirtualCSharpDocumentProvider();
        virtualDocumentRegistration = vscode.workspace.registerTextDocumentContentProvider(
            virtualScheme,
            virtualCSharpDocumentProvider
        );
        virtualUri = vscode.Uri.parse(
            `${virtualScheme}://${testAssetWorkspace.projects[0].projectDirectoryPath}/_virtualFile.cs`
        );
    });

    afterAll(async () => {
        if (isSlnWithGenerator(vscode.workspace)) {
            return;
        }

        await testAssetWorkspace.cleanupWorkspace();
        virtualDocumentRegistration?.dispose();
    });

    test('Virtual documents are operated on.', async () => {
        await vscode.workspace.openTextDocument(virtualUri);

        const position = new vscode.Position(2, 0);
        const completionList = <vscode.CompletionList>(
            await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', virtualUri, position)
        );

        expect(completionList.items.length).toBeGreaterThan(0);
    });
});

class VirtualCSharpDocumentProvider implements vscode.TextDocumentContentProvider {
    onDidChange?: vscode.Event<vscode.Uri>;

    provideTextDocumentContent(_uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<string> {
        return `namespace Test
{

}`;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { should, expect } from 'chai';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { IDisposable } from '../../src/Disposable';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`Virtual Document Tracking ${testAssetWorkspace.description}`, function () {
    let virtualScheme: string = "virtual";
    let virtualDocumentRegistration: IDisposable;

    suiteSetup(async function () {
        should();
        await activateCSharpExtension();
        await testAssetWorkspace.restore();

        let virtualCSharpDocumentProvider = new VirtualCSharpDocumentProvider();
        virtualDocumentRegistration = vscode.workspace.registerTextDocumentContentProvider(virtualScheme, virtualCSharpDocumentProvider);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
        virtualDocumentRegistration.dispose();
    });

    test("Virtual documents are operated on.", async () => {
        let virtualUri = vscode.Uri.parse(`${virtualScheme}://${testAssetWorkspace.projects[0].projectDirectoryPath}/_virtualFile.cs`);
        await vscode.workspace.openTextDocument(virtualUri);

        let position = new vscode.Position(2, 4);
        let completionItems = <vscode.CompletionList>await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", virtualUri, position);

        expect(completionItems.items).to.satisfy(() => {
            let item = completionItems.items.find(item => {
                return item.label === "while";
            });

            return item;
        });
    });
});

class VirtualCSharpDocumentProvider implements vscode.TextDocumentContentProvider {
    onDidChange?: vscode.Event<vscode.Uri>;

    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        return `namespace Test
{

}`;
    }
}
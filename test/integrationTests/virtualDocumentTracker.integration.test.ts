/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { expect, should } from 'chai';
import { activateCSharpExtension, isSlnWithGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { IDisposable } from '../../src/Disposable';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`Virtual Document Tracking ${testAssetWorkspace.description}`, function () {
    const virtualScheme = "virtual";
    let virtualDocumentRegistration: IDisposable;
    let virtualUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        if (isSlnWithGenerator(vscode.workspace)) {
            this.skip();
        }

        await activateCSharpExtension();
        await testAssetWorkspace.restore();

        const virtualCSharpDocumentProvider = new VirtualCSharpDocumentProvider();
        virtualDocumentRegistration = vscode.workspace.registerTextDocumentContentProvider(virtualScheme, virtualCSharpDocumentProvider);
        virtualUri = vscode.Uri.parse(`${virtualScheme}://${testAssetWorkspace.projects[0].projectDirectoryPath}/_virtualFile.cs`);
    });

    suiteTeardown(async () => {
        if (isSlnWithGenerator(vscode.workspace)) {
            return;
        }

        await testAssetWorkspace.cleanupWorkspace();
        virtualDocumentRegistration?.dispose();
    });

    test("Virtual documents are operated on.", async () => {
        await vscode.workspace.openTextDocument(virtualUri);

        let position = new vscode.Position(2, 0);
        let completionList = <vscode.CompletionList>await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", virtualUri, position);

        expect(completionList.items).to.not.be.empty;
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

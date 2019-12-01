/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import OmniSharpCompletionItemProvider from "../../src/features/completionItemProvider";
import * as vscode from 'vscode';
import testAssetWorkspace from "./testAssets/testAssetWorkspace";
import * as path from "path";
import { expect } from "chai";
import { activateCSharpExtension } from "./integrationHelpers";

suite(`${OmniSharpCompletionItemProvider.name}: Returns the completion items`, () => {
    let fileUri: vscode.Uri;

    suiteSetup(async () => {
        await activateCSharpExtension();
        await testAssetWorkspace.restore();

        let fileName = 'completion.cs';
        let dir = testAssetWorkspace.projects[0].projectDirectoryPath;
        fileUri = vscode.Uri.file(path.join(dir, fileName));
        await vscode.commands.executeCommand("vscode.open", fileUri);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns the completion items", async () => {
        let completionList = <vscode.CompletionList>(await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", fileUri, new vscode.Position(8, 31), " "));
        expect(completionList.items).to.not.be.empty;
    });

    test("Preselect is enabled for atleast one completionItem when there is a new", async () => {
        let completionList = <vscode.CompletionList>(await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", fileUri, new vscode.Position(8, 31), " "));
        let preselectList = completionList.items.filter(item => item.preselect === true);
        expect(preselectList).to.not.be.empty;
    });
});
/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import OmniSharpCompletionProvider from "../../src/features/completionProvider";
import * as vscode from 'vscode';
import testAssetWorkspace from "./testAssets/testAssetWorkspace";
import * as path from "path";
import { expect } from "chai";
import { activateCSharpExtension, isRazorWorkspace } from "./integrationHelpers";

suite(`${OmniSharpCompletionProvider.name}: Returns the completion items`, () => {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        // These tests don't run on the BasicRazorApp2_1 solution
        if (isRazorWorkspace(vscode.workspace)) {
            this.skip();
        }

        await activateCSharpExtension();
        await testAssetWorkspace.restore();

        let fileName = 'completion.cs';
        let dir = testAssetWorkspace.projects[0].projectDirectoryPath;
        fileUri = vscode.Uri.file(path.join(dir, fileName));
        await vscode.commands.executeCommand("vscode.open", fileUri);

        // The override bit is commented out to allow later debugging to work correctly.
        let overrideUncomment = new vscode.WorkspaceEdit();
        overrideUncomment.delete(fileUri, new vscode.Range(new vscode.Position(11, 8), new vscode.Position(11, 11)));
        await vscode.workspace.applyEdit(overrideUncomment);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns the completion items", async () => {
        let completionList = <vscode.CompletionList>(await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", fileUri, new vscode.Position(8, 31), " "));
        expect(completionList.items).to.not.be.empty;
    });

    test("Preselect is enabled for at least one completionItem when there is a new", async () => {
        let completionList = <vscode.CompletionList>(await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", fileUri, new vscode.Position(8, 31), " "));
        let preselectList = completionList.items.filter(item => item.preselect === true);
        expect(preselectList).to.not.be.empty;
    });

    test("Resolve adds documentation", async () => {
        let completionList = <vscode.CompletionList>(await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", fileUri, new vscode.Position(8, 31), " ", 10));
        // At least some of the first 10 fully-resolved elements should have documentation attached. If this ever ends up not being
        // true, adjust the cutoff appropriately.
        const documentation = completionList.items.slice(0, 9).filter(item => item.documentation);
        expect(documentation).to.not.be.empty;
    });

    test("Override completion has additional edits", async function () {
        if (process.env.OMNISHARP_DRIVER === 'lsp') {
            this.skip();
        }

        let completionList = <vscode.CompletionList>(await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", fileUri, new vscode.Position(11, 17), " "));
        const nonSnippets = completionList.items.filter(c => c.kind != vscode.CompletionItemKind.Snippet);
        for (const i of nonSnippets) {
            expect((<vscode.SnippetString>i.insertText).value).contains("$0");
            expect(i.additionalTextEdits).is.not.null;
            expect(i.additionalTextEdits[0].range.start.line).equals(11);
            expect(i.additionalTextEdits[0].range.start.character).equals(8);
            expect(i.additionalTextEdits[0].range.end.line).equals(11);
            expect(i.additionalTextEdits[0].range.end.character).equals(16);
        }
    });
});

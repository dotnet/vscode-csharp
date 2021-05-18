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

    test("Resolve adds documentation", async () => {
        let completionList = <vscode.CompletionList>(await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", fileUri, new vscode.Position(8, 31), /*trigger character*/ undefined, /* completions to resolve */ 10));
        // At least some of the first 10 fully-resolved elements should have documentation attached. If this ever ends up not being
        // true, adjust the cutoff appropriately.
        const documentation = completionList.items.slice(0, 9).filter(item => item.documentation);
        expect(documentation).to.not.be.empty;
    });

    test("Override completion has additional edits sync", async () => {
        let completionList = <vscode.CompletionList>(await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", fileUri, new vscode.Position(11, 17), " ", 4));
        const nonSnippets = completionList.items.filter(c => c.kind != vscode.CompletionItemKind.Snippet);

        let sawAdditionalTextEdits = false;
        let sawEmptyAdditionalTextEdits = false;

        for (const i of nonSnippets) {
            expect((<vscode.SnippetString>i.insertText).value).contains("$0");
            if (i.additionalTextEdits) {
                sawAdditionalTextEdits = true;
                expect(i.additionalTextEdits).to.be.array();
                expect(i.additionalTextEdits.length).to.equal(1);
                expect(i.additionalTextEdits[0].newText).to.equal("using singleCsproj2;\n");
                expect(i.additionalTextEdits[0].range.start.line).to.equal(1);
                expect(i.additionalTextEdits[0].range.start.character).to.equal(0);
                expect(i.additionalTextEdits[0].range.end.line).to.equal(1);
                // Can be either 0 or 1, depending on the platform this test is run on
                expect(i.additionalTextEdits[0].range.end.character).to.be.lessThanOrEqual(1).and.greaterThanOrEqual(0);
            }
            else {
                sawEmptyAdditionalTextEdits = true;
            }
        }

        expect(sawAdditionalTextEdits).to.be.true;
        expect(sawEmptyAdditionalTextEdits).to.be.true;
    });
});

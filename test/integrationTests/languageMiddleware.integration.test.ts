/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import * as path from "path";
import testAssetWorkspace from "./testAssets/testAssetWorkspace";
import { expect } from "chai";
import { activateCSharpExtension, isRazorWorkspace } from './integrationHelpers';
import { LanguageMiddleware, LanguageMiddlewareFeature } from "../../src/omnisharp/LanguageMiddlewareFeature";

suite(`${LanguageMiddlewareFeature.name}: ${testAssetWorkspace.description}`, () => {
    let fileUri: vscode.Uri;
    let remappedFileUri: vscode.Uri;

    suiteSetup(async function () {
        // These tests don't run on the BasicRazorApp2_1 solution
        if (isRazorWorkspace(vscode.workspace)) {
            this.skip();
        }

        await activateCSharpExtension();
        await registerLanguageMiddleware();
        await testAssetWorkspace.restore();

        let projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        let remappedFileName = 'remapped.txt';
        remappedFileUri = vscode.Uri.file(path.join(projectDirectory, remappedFileName));
        let fileName = 'remap.cs';
        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        await vscode.commands.executeCommand("vscode.open", fileUri);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns the remapped workspaceEdit", async () => {

        // Avoid flakiness with renames.
        await new Promise(r => setTimeout(r, 2000));

        let workspaceEdit = <vscode.WorkspaceEdit>(await vscode.commands.executeCommand(
            "vscode.executeDocumentRenameProvider",
            fileUri,
            new vscode.Position(4, 30),
            'newName'));

        let entries = workspaceEdit!.entries();
        expect(entries.length).to.be.equal(1);
        expect(entries[0][0].path).to.be.equal(remappedFileUri.path);
    });

    test("Returns the remapped references", async () => {
        let references = <vscode.Location[]>(await vscode.commands.executeCommand(
            "vscode.executeReferenceProvider",
            fileUri,
            new vscode.Position(4, 30)));
        expect(references.length).to.be.equal(1);
        expect(references[0].uri.path).to.be.equal(remappedFileUri.path);
    });

    test("Returns the remapped definition", async () => {
        let definitions = <vscode.Location[]>(await vscode.commands.executeCommand(
            "vscode.executeDefinitionProvider",
            fileUri,
            new vscode.Position(4, 30)));
        expect(definitions.length).to.be.equal(1);
        expect(definitions[0].uri.path).to.be.equal(remappedFileUri.path);
    });

    test("Returns the remapped implementations", async () => {
        let implementations = <vscode.Location[]>(await vscode.commands.executeCommand(
            "vscode.executeImplementationProvider",
            fileUri,
            new vscode.Position(4, 30)));
        expect(implementations.length).to.be.equal(1);
        expect(implementations[0].uri.path).to.be.equal(remappedFileUri.path);
    });
});

async function registerLanguageMiddleware() {
    const middleware = new TestLanguageMiddleware();
    await vscode.commands.executeCommand<void>('omnisharp.registerLanguageMiddleware', middleware);
}

class TestLanguageMiddleware implements LanguageMiddleware {
    public readonly language = 'MyLang';
    private readonly remappedFileUri: vscode.Uri;
    private readonly fileToRemapUri: vscode.Uri;

    constructor() {
        let projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        let remappedFileName = 'remapped.txt';
        this.remappedFileUri = vscode.Uri.file(path.join(projectDirectory, remappedFileName));
        let fileToRemap = 'remap.cs';
        this.fileToRemapUri = vscode.Uri.file(path.join(projectDirectory, fileToRemap));
    }

    remapWorkspaceEdit?(workspaceEdit: vscode.WorkspaceEdit, token: vscode.CancellationToken): vscode.ProviderResult<vscode.WorkspaceEdit> {
        const newEdit = new vscode.WorkspaceEdit();
        for (const entry of workspaceEdit.entries()) {
            const uri = entry[0];
            const edits = entry[1];
            if (uri.path === this.fileToRemapUri.path) {
                // Return a naive edit in the remapped file.
                newEdit.set(this.remappedFileUri, [new vscode.TextEdit(new vscode.Range(0, 0, 0, 1), '')]);
            } else {
                newEdit.set(uri, edits);
            }
        }
        return newEdit;
    }

    remapLocations?(locations: vscode.Location[], token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location[]> {
        const remapped = new Array<vscode.Location>();
        for (const location of locations) {
            if (location.uri.path === this.fileToRemapUri.path) {
                // Naively return a remapped file.
                remapped.push(new vscode.Location(this.remappedFileUri, new vscode.Position(0, 0)));
            } else {
                remapped.push(location);
            }
        }
        return remapped;
    }
}
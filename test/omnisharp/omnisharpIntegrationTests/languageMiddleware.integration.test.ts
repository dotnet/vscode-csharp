/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import * as path from 'path';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { activateCSharpExtension, describeIfNotRazorOrGenerator } from './integrationHelpers';
import { LanguageMiddleware, LanguageMiddlewareFeature } from '../../../src/omnisharp/languageMiddlewareFeature';

describeIfNotRazorOrGenerator(`${LanguageMiddlewareFeature.name}: ${testAssetWorkspace.description}`, () => {
    let fileUri: vscode.Uri;
    let remappedFileUri: vscode.Uri;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await registerLanguageMiddleware();
        await testAssetWorkspace.restore();

        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        const remappedFileName = 'remapped.txt';
        remappedFileUri = vscode.Uri.file(path.join(projectDirectory, remappedFileName));
        const fileName = 'remap.cs';
        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        await vscode.commands.executeCommand('vscode.open', fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Returns the remapped workspaceEdit', async () => {
        // Avoid flakiness with renames.
        await new Promise((r) => setTimeout(r, 2000));

        const workspaceEdit = <vscode.WorkspaceEdit>(
            await vscode.commands.executeCommand(
                'vscode.executeDocumentRenameProvider',
                fileUri,
                new vscode.Position(4, 30),
                'newName'
            )
        );

        const entries = workspaceEdit!.entries();
        expect(entries.length).toEqual(1);
        expect(entries[0][0].path).toEqual(remappedFileUri.path);
    });

    test('Returns the remapped references', async () => {
        const references = <vscode.Location[]>(
            await vscode.commands.executeCommand('vscode.executeReferenceProvider', fileUri, new vscode.Position(4, 30))
        );
        expect(references.length).toEqual(1);
        expect(references[0].uri.path).toEqual(remappedFileUri.path);
    });

    test('Returns the remapped definition', async () => {
        const definitions = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                fileUri,
                new vscode.Position(4, 30)
            )
        );
        expect(definitions.length).toEqual(1);
        expect(definitions[0].uri.path).toEqual(remappedFileUri.path);
    });

    test('Returns the remapped implementations', async () => {
        const implementations = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeImplementationProvider',
                fileUri,
                new vscode.Position(4, 30)
            )
        );
        expect(implementations.length).toEqual(1);
        expect(implementations[0].uri.path).toEqual(remappedFileUri.path);
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
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        const remappedFileName = 'remapped.txt';
        this.remappedFileUri = vscode.Uri.file(path.join(projectDirectory, remappedFileName));
        const fileToRemap = 'remap.cs';
        this.fileToRemapUri = vscode.Uri.file(path.join(projectDirectory, fileToRemap));
    }

    remapWorkspaceEdit(
        workspaceEdit: vscode.WorkspaceEdit,
        _: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.WorkspaceEdit> {
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

    remapLocations(
        locations: vscode.Location[] | vscode.LocationLink[],
        _: vscode.CancellationToken
    ): vscode.ProviderResult<Array<vscode.Location | vscode.LocationLink>> {
        const remapped = new Array<vscode.Location | vscode.LocationLink>();
        for (const location of locations) {
            if (location instanceof vscode.Location) {
                if (location.uri.path === this.fileToRemapUri.path) {
                    // Naively return a remapped file.
                    remapped.push(new vscode.Location(this.remappedFileUri, new vscode.Position(0, 0)));
                } else {
                    remapped.push(location);
                }
            } else {
                if (location.targetUri.path === this.fileToRemapUri.path) {
                    // Naively return a remapped file.
                    remapped.push(new vscode.Location(this.remappedFileUri, new vscode.Position(0, 0)));
                } else {
                    remapped.push(location);
                }
            }
        }
        return remapped;
    }
}

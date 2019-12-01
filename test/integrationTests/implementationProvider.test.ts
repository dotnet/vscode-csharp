/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import CSharpImplementationProvider from "../../src/features/implementationProvider";
import * as path from "path";
import testAssetWorkspace from "./testAssets/testAssetWorkspace";
import { expect } from "chai";
import { activateCSharpExtension } from './integrationHelpers';

suite(`${CSharpImplementationProvider.name}: ${testAssetWorkspace.description}`, () => {
    let fileUri: vscode.Uri;

    suiteSetup(async () => {
        await activateCSharpExtension();
        await testAssetWorkspace.restore();

        let fileName = 'implementation.cs';
        let projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        await vscode.commands.executeCommand("vscode.open", fileUri);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns the implementation", async() => {
        let implementationList = <vscode.Location[]>(await vscode.commands.executeCommand("vscode.executeImplementationProvider", fileUri, new vscode.Position(4, 22)));
        expect(implementationList.length).to.be.equal(2);
    });
});
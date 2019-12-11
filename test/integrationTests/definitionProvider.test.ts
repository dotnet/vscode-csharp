/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import CSharpDefinitionProvider from "../../src/features/definitionProvider";
import * as path from "path";
import testAssetWorkspace from "./testAssets/testAssetWorkspace";
import { expect } from "chai";
import { activateCSharpExtension } from './integrationHelpers';

suite(`${CSharpDefinitionProvider.name}: ${testAssetWorkspace.description}`, () => {
    let fileUri: vscode.Uri;

    suiteSetup(async () => {
        await activateCSharpExtension();
        await testAssetWorkspace.restore();

        let fileName = 'definition.cs';
        let projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        await vscode.commands.executeCommand("vscode.open", fileUri);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns the definition", async() => {
        let definitionList = <vscode.Location[]>(await vscode.commands.executeCommand("vscode.executeDefinitionProvider", fileUri, new vscode.Position(10, 31)));
        expect(definitionList.length).to.be.equal(1);
        expect(definitionList[0]).to.exist;
        expect(definitionList[0].uri.path).to.contain("definition.cs");
    });

    // Skipping due to https://github.com/OmniSharp/omnisharp-vscode/issues/3458
    test.skip("Returns the definition from Metadata", async() => {
        let definitionList = <vscode.Location[]>(await vscode.commands.executeCommand("vscode.executeDefinitionProvider", fileUri, new vscode.Position(10, 25)));
        expect(definitionList.length).to.be.equal(1);
        expect(definitionList[0]).to.exist;
        expect(definitionList[0].uri.path).to.contain("[metadata] Console.cs");
    });
});
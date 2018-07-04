/*--------------------------------------------------------------------------------------------- 
*  Copyright (c) Microsoft Corporation. All rights reserved. 
*  Licensed under the MIT License. See License.txt in the project root for license information. 
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import CSharpImplementationProvider from "../../src/features/implementationProvider";
import CSharpExtensionExports from "../../src/CSharpExtensionExports";
import * as path from "path";
import testAssetWorkspace from "./testAssets/testAssetWorkspace";
import { expect } from "chai";

suite(`${CSharpImplementationProvider.name}: ${testAssetWorkspace.description}`, () => {
    let fileUri: vscode.Uri;
    
    suiteSetup(async () => {
        let csharpExtension = vscode.extensions.getExtension<CSharpExtensionExports>("ms-vscode.csharp");
        if (!csharpExtension.isActive) {
            await csharpExtension.activate();
        }

        await csharpExtension.exports.initializationFinished();
        let fileName = 'implementation.cs';
        let dir = path.dirname(testAssetWorkspace.projects[0].projectDirectoryPath);
        fileUri = vscode.Uri.file(path.join(dir, fileName));
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
/*--------------------------------------------------------------------------------------------- 
*  Copyright (c) Microsoft Corporation. All rights reserved. 
*  Licensed under the MIT License. See License.txt in the project root for license information. 
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

import { should } from 'chai';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import poll from './poll';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`ReAnalyze: ${testAssetWorkspace.description}`, function () {
    let interfaceUri: vscode.Uri;
    let interfaceImplUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        await testAssetWorkspace.restore();
        await activateCSharpExtension();

        let projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        interfaceUri = vscode.Uri.file(path.join(projectDirectory, 'ISomeInterface.cs'));
        interfaceImplUri = vscode.Uri.file(path.join(projectDirectory, 'SomeInterfaceImpl.cs'));

        await vscode.commands.executeCommand("vscode.open", interfaceImplUri);
        await vscode.commands.executeCommand("vscode.open", interfaceUri);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("When interface is manually renamed, then return correct analysis after re-analysis of project", async function () {
        await vscode.commands.executeCommand("vscode.open", interfaceUri);

        let editor = vscode.window.activeTextEditor;

        await editor.edit(editorBuilder => editorBuilder.replace(new vscode.Range(2, 0, 2, 50), 'public interface ISomeInterfaceRenamedNow'));

        await vscode.commands.executeCommand('o.reanalyze.currentProject', interfaceImplUri);

        await poll(() => vscode.languages.getDiagnostics(interfaceImplUri), 10*1000, 500,
            r => r.find(x => x.message.includes("CS0246")) != undefined);
    });
});

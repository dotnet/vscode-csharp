/*--------------------------------------------------------------------------------------------- 
*  Copyright (c) Microsoft Corporation. All rights reserved. 
*  Licensed under the MIT License. See License.txt in the project root for license information. 
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

import { should, expect } from 'chai';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import poll from './poll';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`DiagnosticProvider: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        let csharpConfig = vscode.workspace.getConfiguration('omnisharp');
        await csharpConfig.update('enableRoslynAnalyzers', true);

        await testAssetWorkspace.restore();
        await activateCSharpExtension();

        let fileName = 'diagnostics.cs';
        let projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        let filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);

        await vscode.commands.executeCommand("vscode.open", fileUri);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns any diagnostics from file", async function () {
        let result = await poll(() => vscode.languages.getDiagnostics(fileUri), 10*1000, 500);
        expect(result.length).to.be.greaterThan(0);
    });

    test("Return fadeout diagnostics like unused usings", async function () {
        let result = await poll(() => vscode.languages.getDiagnostics(fileUri), 10*1000, 500);
        expect(result.map(x => x.message).join('|')).to.have.string("IDE0005");
        expect(result.map(x => x.tags).reduce(x => x)).to.include(vscode.DiagnosticTag.Unnecessary);
    });
});
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

    test("Return unnecessary tag in case of unnesessary using", async function () {
        let result = await poll(() => vscode.languages.getDiagnostics(fileUri), 15*1000, 500);

        let cs8019 = result.find(x => x.message.includes("CS8019"));
        expect(cs8019).to.not.be.undefined;
        expect(cs8019.tags).to.include(vscode.DiagnosticTag.Unnecessary);
    });

    test("Return fadeout diagnostics like unused usings based on roslyn analyzers", async function () {
        this.skip(); // Remove this once https://github.com/OmniSharp/omnisharp-roslyn/issues/1458 is resolved.
        let result = await poll(() => vscode.languages.getDiagnostics(fileUri), 15*1000, 500);

        let ide0005 = result.find(x => x.message.includes("IDE0005"));
        expect(ide0005).to.not.be(undefined);
        expect(ide0005.tags).to.include(vscode.DiagnosticTag.Unnecessary);
    });
});

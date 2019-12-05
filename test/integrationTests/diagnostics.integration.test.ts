/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

import { should, expect } from 'chai';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { poll, assertWithPoll } from './poll';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

function setDiagnosticWorkspaceLimit(to: number | null) {
    let csharpConfig = vscode.workspace.getConfiguration('csharp');
    return csharpConfig.update('maxProjectFileCountForDiagnosticAnalysis', to);
}

suite(`DiagnosticProvider: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;
    let secondaryFileUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        await activateCSharpExtension();
        await testAssetWorkspace.restore();

        let fileName = 'diagnostics.cs';
        let secondaryFileName = 'secondaryDiagnostics.cs';
        let projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;

        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        secondaryFileUri = vscode.Uri.file(path.join(projectDirectory, secondaryFileName));
    });

    suite("small workspace (based on maxProjectFileCountForDiagnosticAnalysis setting)", () => {
        suiteSetup(async function () {
            should();
            await activateCSharpExtension();
            await testAssetWorkspace.restore();
            await vscode.commands.executeCommand("vscode.open", fileUri);
        });

        test("Returns any diagnostics from file", async function () {
            await assertWithPoll(() => vscode.languages.getDiagnostics(fileUri), 10 * 1000, 500,
                res => expect(res.length).to.be.greaterThan(0));
        });

        test("Return unnecessary tag in case of unnesessary using", async function () {
            let result = await poll(() => vscode.languages.getDiagnostics(fileUri), 15 * 1000, 500);

            let cs8019 = result.find(x => x.code === "CS8019");
            expect(cs8019).to.not.be.undefined;
            expect(cs8019.tags).to.include(vscode.DiagnosticTag.Unnecessary);
        });

        test("Return fadeout diagnostics like unused variables based on roslyn analyzers", async function () {
            let result = await poll(() => vscode.languages.getDiagnostics(fileUri), 15 * 1000, 500, result => result.find(x => x.code === "IDE0059") != undefined);

            let ide0059 = result.find(x => x.code === "IDE0059");
            expect(ide0059.tags).to.include(vscode.DiagnosticTag.Unnecessary);
        });

        test("On small workspaces also show/fetch closed document analysis results", async function () {
            await assertWithPoll(() => vscode.languages.getDiagnostics(secondaryFileUri), 15 * 1000, 500, res => expect(res.length).to.be.greaterThan(0));
        });

        suiteTeardown(async () => {
            await testAssetWorkspace.cleanupWorkspace();
        });
    });

    suite("large workspace (based on maxProjectFileCountForDiagnosticAnalysis setting)", () => {
        suiteSetup(async function () {
            should();
            await setDiagnosticWorkspaceLimit(1);
            await testAssetWorkspace.restore();
            await activateCSharpExtension();
        });

        test("When workspace is count as 'large', then only show/fetch diagnostics from open documents", async function () {
            // This is to trigger manual cleanup for diagnostics before test because we modify max project file count on fly.
            await vscode.commands.executeCommand("vscode.open", secondaryFileUri);
            await vscode.commands.executeCommand("vscode.open", fileUri);

            await assertWithPoll(() => vscode.languages.getDiagnostics(fileUri), 10 * 1000, 500, openFileDiag =>  expect(openFileDiag.length).to.be.greaterThan(0));
            await assertWithPoll(() => vscode.languages.getDiagnostics(secondaryFileUri), 10 * 1000, 500, secondaryDiag => expect(secondaryDiag.length).to.be.eq(0));
        });

        suiteTeardown(async () => {
            await testAssetWorkspace.cleanupWorkspace();
        });
    });
});

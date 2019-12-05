/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

import { expect } from 'chai';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`SignatureHelp: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        await activateCSharpExtension();
        await testAssetWorkspace.restore();

        let fileName = 'sigHelp.cs';
        let dir = testAssetWorkspace.projects[0].projectDirectoryPath;
        let loc = path.join(dir, fileName);
        fileUri = vscode.Uri.file(loc);
        await vscode.commands.executeCommand("vscode.open", fileUri);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns response with documentation as undefined when method does not have documentation", async function () {
        let c = await GetSignatureHelp(fileUri, new vscode.Position(19, 23));
        expect(c.signatures[0].documentation).to.be.undefined;
    });

    test("Returns label when method does not have documentation", async function () {
        let c = await GetSignatureHelp(fileUri, new vscode.Position(19, 23));
        expect(c.signatures[0].label).to.equal(`void sigHelp.noDocMethod()`);
    });

    test("Returns summary as documentation for the method", async function () {
        let c = await GetSignatureHelp(fileUri, new vscode.Position(18, 18));
        expect(c.signatures[0].documentation).to.equal(`DoWork is some method.`);
    });

    test("Returns label for the method", async function () {
        let c = await GetSignatureHelp(fileUri, new vscode.Position(18, 18));
        expect(c.signatures[0].label).to.equal(`void sigHelp.DoWork(int Int1, float Float1, double Double1)`);
    });

    test("Returns label for the parameters", async function () {
        let c = await GetSignatureHelp(fileUri, new vscode.Position(18, 18));
        expect(c.signatures[0].parameters[0].label).to.equal(`int Int1`);
        expect(c.signatures[0].parameters[1].label).to.equal(`float Float1`);
    });

    test("Returns documentation for the parameters", async function () {
        let c = await GetSignatureHelp(fileUri, new vscode.Position(18, 18));
        expect((<vscode.MarkdownString>c.signatures[0].parameters[0].documentation).value).to.equal(`**Int1**: Used to indicate status.`);
        expect((<vscode.MarkdownString>c.signatures[0].parameters[1].documentation).value).to.equal(`**Float1**: Used to specify context.`);
    });

    test("Signature Help identifies active parameter if there is no comma", async function () {
        let c = await GetSignatureHelp(fileUri, new vscode.Position(18, 18));
        expect(c.signatures[0].parameters[c.activeParameter].label).to.equal(`int Int1`);
    });

    test("Signature Help identifies active parameter based on comma", async function () {
        let c = await GetSignatureHelp(fileUri, new vscode.Position(18, 20));
        expect(c.signatures[0].parameters[c.activeParameter].label).to.equal(`float Float1`);
    });

    test("Signature Help identifies active parameter based on comma for multiple commas", async function () {
        let c = await GetSignatureHelp(fileUri, new vscode.Position(18, 27));
        expect(c.signatures[0].parameters[c.activeParameter].label).to.equal(`double Double1`);
    });
});

async function GetSignatureHelp(fileUri: vscode.Uri, position: vscode.Position) {
    return <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, position);
}
/*--------------------------------------------------------------------------------------------- 
*  Copyright (c) Microsoft Corporation. All rights reserved. 
*  Licensed under the MIT License. See License.txt in the project root for license information. 
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

import poll from './poll';
import { should, expect } from 'chai';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { omnisharp } from '../../src/omnisharp/extension';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`SignatureHelp: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;
    suiteSetup(async function () {
        should();

        let csharpExtension = vscode.extensions.getExtension("ms-vscode.csharp");
        if (!csharpExtension.isActive) {
            await csharpExtension.activate();
        }

        await csharpExtension.exports.initializationFinished;

        let fileName = 'sigHelp.cs';
        let dir = path.dirname(testAssetWorkspace.projects[0].projectDirectoryPath);
        let loc = path.join(dir, fileName);
        fileUri = vscode.Uri.file(loc);
        await omnisharp.waitForEmptyEventQueue();
        await vscode.commands.executeCommand("vscode.open", fileUri);
    });

    
    test("Returns response with documentation as undefined when method does not have documentation", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(19, 23));
        expect(c.signatures[0].documentation).to.be.undefined;
    });

    test("Returns label when method does not have documentation", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(19, 23));
        let answer = `void testissue.noDocMethod()`;
        expect(c.signatures[0].label).to.equal(answer);
    });

    test("Returns summary as documentation for the method", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(18, 18));
        let answer = `DoWork is some method.`;
        expect(c.signatures[0].documentation).to.equal(answer);
    });

    test("Returns label for the method", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(18, 18));
        let answer = `void testissue.DoWork(int Int1, float Float1)`;
        expect(c.signatures[0].label).to.equal(answer);
    });

    test("Returns label for the parameters", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(18, 18));
        let param1 = `int Int1`;
        let param2 = `float Float1`;
        expect(c.signatures[0].parameters[0].label).to.equal(param1);
        expect(c.signatures[0].parameters[1].label).to.equal(param2);
    });

    test("Returns documentation for the parameters", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(18, 18));
        let param1 = `**Int1**: Used to indicate status.`;
        let param2 = `**Float1**: Used to specify context.`;
        expect((<vscode.MarkdownString> c.signatures[0].parameters[0].documentation).value).to.equal(param1);
        expect((<vscode.MarkdownString> c.signatures[0].parameters[1].documentation).value).to.equal(param2);
    });

    test("Signature Help identifies active parameter if there is no comma", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(18, 18));
        let answer = `int Int1`;
        expect(c.signatures[0].parameters[c.activeParameter].label).to.equal(answer);
    });

    test("Signature Help identifies active parameter based on comma", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(18, 20));
        let answer = `float Float1`;
        expect(c.signatures[0].parameters[c.activeParameter].label).to.equal(answer);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });
});
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
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(20, 23));
        expect(c.signatures[0].documentation).to.be.undefined;
    });

    test("Returns label when method does not have documentation", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(20, 23));
        let answer = `void testissue.noDocMethod()`;
        expect(c.signatures[0].label).to.equal(answer);
    });

    test("Returns summary as documentation for the method", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(19, 19));
        let answer = `Checks if object is tagged with the tag.`;
        expect(c.signatures[0].documentation).to.equal(answer);
    });

    test("Returns label for the method", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(19, 19));
        let answer = `void testissue.Compare(int gameObject, string tagName)`;
        expect(c.signatures[0].label).to.equal(answer);
    });

    test("Returns label for the parameters", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(19, 19));
        let param1 = `int gameObject`;
        let param2 = `string tagName`;
        expect(c.signatures[0].parameters[0].label).to.equal(param1);
        expect(c.signatures[0].parameters[1].label).to.equal(param2);
    });

    test("Returns documentation for the parameters", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(19, 19));
        let param1 = `**gameObject**: The game object.`;
        let param2 = `**tagName**: Name of the tag.`;
        expect((<vscode.MarkdownString> c.signatures[0].parameters[0].documentation).value).to.equal(param1);
        expect((<vscode.MarkdownString> c.signatures[0].parameters[1].documentation).value).to.equal(param2);
    });

    test("Signature Help identifies active parameter if there is no comma", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(19, 19));
        let answer = `int gameObject`;
        expect(c.signatures[0].parameters[c.activeParameter].label).to.equal(answer);
    });

    test("Signature Help identifies active parameter based on comma", async function () {
        let c = <vscode.SignatureHelp>await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", fileUri, new vscode.Position(19, 21));
        let answer = `string tagName`;
        expect(c.signatures[0].parameters[c.activeParameter].label).to.equal(answer);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });
});
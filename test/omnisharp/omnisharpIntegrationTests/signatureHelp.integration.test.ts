/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import * as path from 'path';
import { activateCSharpExtension, describeIfNotRazorOrGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';

describeIfNotRazorOrGenerator(`SignatureHelp: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        const fileName = 'sigHelp.cs';
        const dir = testAssetWorkspace.projects[0].projectDirectoryPath;
        const loc = path.join(dir, fileName);
        fileUri = vscode.Uri.file(loc);
        await vscode.commands.executeCommand('vscode.open', fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Returns response with documentation as undefined when method does not have documentation', async function () {
        const c = await GetSignatureHelp(fileUri, new vscode.Position(19, 23));
        expect(c.signatures[0].documentation).toBe(undefined);
    });

    test('Returns label when method does not have documentation', async function () {
        const c = await GetSignatureHelp(fileUri, new vscode.Position(19, 23));
        expect(c.signatures[0].label).toEqual(`void sigHelp.noDocMethod()`);
    });

    test('Returns summary as documentation for the method', async function () {
        const c = await GetSignatureHelp(fileUri, new vscode.Position(18, 18));
        expect(c.signatures[0].documentation).toEqual(`DoWork is some method.`);
    });

    test('Returns label for the method', async function () {
        const c = await GetSignatureHelp(fileUri, new vscode.Position(18, 18));
        expect(c.signatures[0].label).toEqual(`void sigHelp.DoWork(int Int1, float Float1, double Double1)`);
    });

    test('Returns label for the parameters', async function () {
        const c = await GetSignatureHelp(fileUri, new vscode.Position(18, 18));
        expect(c.signatures[0].parameters[0].label).toEqual(`int Int1`);
        expect(c.signatures[0].parameters[1].label).toEqual(`float Float1`);
    });

    test('Returns documentation for the parameters', async function () {
        const c = await GetSignatureHelp(fileUri, new vscode.Position(18, 18));
        expect((<vscode.MarkdownString>c.signatures[0].parameters[0].documentation).value).toEqual(
            `**Int1**: Used to indicate status.`
        );
        expect((<vscode.MarkdownString>c.signatures[0].parameters[1].documentation).value).toEqual(
            `**Float1**: Used to specify context.`
        );
    });

    test('Signature Help identifies active parameter if there is no comma', async function () {
        const c = await GetSignatureHelp(fileUri, new vscode.Position(18, 18));
        expect(c.signatures[0].parameters[c.activeParameter].label).toEqual(`int Int1`);
    });

    test('Signature Help identifies active parameter based on comma', async function () {
        const c = await GetSignatureHelp(fileUri, new vscode.Position(18, 20));
        expect(c.signatures[0].parameters[c.activeParameter].label).toEqual(`float Float1`);
    });

    test('Signature Help identifies active parameter based on comma for multiple commas', async function () {
        const c = await GetSignatureHelp(fileUri, new vscode.Position(18, 27));
        expect(c.signatures[0].parameters[c.activeParameter].label).toEqual(`double Double1`);
    });
});

async function GetSignatureHelp(fileUri: vscode.Uri, position: vscode.Position) {
    return <vscode.SignatureHelp>(
        await vscode.commands.executeCommand('vscode.executeSignatureHelpProvider', fileUri, position)
    );
}

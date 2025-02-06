/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { activateCSharpExtension, closeAllEditorsAsync, openFileInWorkspaceAsync } from './integrationHelpers';
import { describe, beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';

describe(`Signature Help Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    beforeEach(async () => {
        await openFileInWorkspaceAsync(path.join('src', 'app', 'sigHelp.cs'));
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('Includes label when no documentation', async function () {
        const signatureHelp = await getSignatureHelp(new vscode.Position(19, 24));
        expect(signatureHelp.signatures[0].label).toEqual(`void sigHelp.noDocMethod()`);
        expect(signatureHelp.signatures[0].documentation).toBe(undefined);
    });

    test('Includes method and parameter documentation', async function () {
        const signatureHelp = await getSignatureHelp(new vscode.Position(18, 19));
        expect(signatureHelp.signatures[0].label).toEqual(
            `void sigHelp.DoWork(int Int1, float Float1, double Double1)`
        );
        expect(signatureHelp.signatures[0].documentation).toEqual(`DoWork is some method.`);

        expect(signatureHelp.signatures[0].parameters[0].label).toEqual(`Int1`);
        expect(signatureHelp.signatures[0].parameters[1].label).toEqual(`Float1`);

        expect(<string>signatureHelp.signatures[0].parameters[0].documentation).toEqual(`Used to indicate status.`);
        expect(<string>signatureHelp.signatures[0].parameters[1].documentation).toEqual(`Used to specify context.`);
    });

    test('Identifies active parameter if there is no comma', async function () {
        const signatureHelp = await getSignatureHelp(new vscode.Position(18, 19));
        expect(signatureHelp.signatures[0].parameters[signatureHelp.activeParameter].label).toEqual(`Int1`);
    });

    test('Identifies active parameter based on comma', async function () {
        const signatureHelp = await getSignatureHelp(new vscode.Position(18, 21));
        expect(signatureHelp.signatures[0].parameters[signatureHelp.activeParameter].label).toEqual(`Float1`);
    });

    test('Identifies active parameter based on comma for multiple commas', async function () {
        const signatureHelp = await getSignatureHelp(new vscode.Position(18, 28));
        expect(signatureHelp.signatures[0].parameters[signatureHelp.activeParameter].label).toEqual(`Double1`);
    });

    test('Uses inner documentation from inside nested method call', async function () {
        const signatureHelp = await getSignatureHelp(new vscode.Position(20, 24));
        expect(signatureHelp.signatures[0].label).toEqual(`string sigHelp.Inner()`);
        expect(signatureHelp.signatures[0].documentation).toEqual(`Inner`);
    });

    test('Uses outer documentation from outside nested method call', async function () {
        const signatureHelp = await getSignatureHelp(new vscode.Position(20, 18));
        expect(signatureHelp.signatures[0].label).toEqual(`string sigHelp.Outer(string s)`);
        expect(signatureHelp.signatures[0].documentation).toEqual(`Outer`);
    });
});

async function getSignatureHelp(position: vscode.Position): Promise<vscode.SignatureHelp> {
    return <vscode.SignatureHelp>(
        await vscode.commands.executeCommand(
            'vscode.executeSignatureHelpProvider',
            vscode.window.activeTextEditor!.document.uri,
            position
        )
    );
}

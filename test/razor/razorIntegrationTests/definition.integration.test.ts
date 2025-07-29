/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { beforeAll, afterAll, test, expect, beforeEach } from '@jest/globals';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as integrationHelpers from '../../lsptoolshost/integrationTests/integrationHelpers';

integrationHelpers.describeIfWindows(`Razor Definition ${testAssetWorkspace.description}`, function () {
    beforeAll(async function () {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        await integrationHelpers.activateCSharpExtension();
    });

    beforeEach(async function () {
        await integrationHelpers.openFileInWorkspaceAsync(path.join('Pages', 'Definition.razor'));
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Go To Definition', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const position = new vscode.Position(6, 41);
        const locations = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                vscode.window.activeTextEditor!.document.uri,
                position
            )
        );

        expect(locations.length).toBe(1);
        const definitionLocation = locations[0];

        expect(definitionLocation.uri.path).toBe(vscode.window.activeTextEditor!.document.uri.path);
        expect(definitionLocation.range.start.line).toBe(11);
        expect(definitionLocation.range.start.character).toBe(16);
        expect(definitionLocation.range.end.line).toBe(11);
        expect(definitionLocation.range.end.character).toBe(28);
    });

    test('Find All References', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const position = new vscode.Position(6, 41);
        const locations = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeReferenceProvider',
                vscode.window.activeTextEditor!.document.uri,
                position
            )
        );

        expect(locations.length).toBe(3);

        let definitionLocation = locations[0];
        expect(definitionLocation.uri.path).toBe(vscode.window.activeTextEditor!.document.uri.path);
        expect(definitionLocation.range.start.line).toBe(6);
        expect(definitionLocation.range.start.character).toBe(33);
        expect(definitionLocation.range.end.line).toBe(6);
        expect(definitionLocation.range.end.character).toBe(45);

        definitionLocation = locations[1];
        expect(definitionLocation.uri.path).toBe(vscode.window.activeTextEditor!.document.uri.path);
        expect(definitionLocation.range.start.line).toBe(11);
        expect(definitionLocation.range.start.character).toBe(16);
        expect(definitionLocation.range.end.line).toBe(11);
        expect(definitionLocation.range.end.character).toBe(28);

        definitionLocation = locations[2];
        expect(definitionLocation.uri.path).toBe(vscode.window.activeTextEditor!.document.uri.path);
        expect(definitionLocation.range.start.line).toBe(15);
        expect(definitionLocation.range.start.character).toBe(8);
        expect(definitionLocation.range.end.line).toBe(15);
        expect(definitionLocation.range.end.character).toBe(20);
    });

    test('Go To Implementation', async () => {
        if (!integrationHelpers.isRazorWorkspace(vscode.workspace)) {
            return;
        }

        const position = new vscode.Position(18, 18);
        const locations = <vscode.Location[]>(
            await vscode.commands.executeCommand(
                'vscode.executeImplementationProvider',
                vscode.window.activeTextEditor!.document.uri,
                position
            )
        );

        expect(locations.length).toBe(1);
        const definitionLocation = locations[0];

        expect(definitionLocation.uri.path).toBe(vscode.window.activeTextEditor!.document.uri.path);
        expect(definitionLocation.range.start.line).toBe(23);
        expect(definitionLocation.range.start.character).toBe(10);
        expect(definitionLocation.range.end.line).toBe(23);
        expect(definitionLocation.range.end.character).toBe(19);
    });
});

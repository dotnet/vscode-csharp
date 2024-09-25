/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import {
    activateCSharpExtension,
    closeAllEditorsAsync,
    openFileInWorkspaceAsync,
    sortLocations,
} from './integrationHelpers';
import { describe, beforeAll, beforeEach, afterAll, test, expect, afterEach } from '@jest/globals';

describe(`Find References Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    beforeEach(async () => {
        await openFileInWorkspaceAsync(path.join('src', 'app', 'reference.cs'));
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
    });

    test('Finds references in same file', async () => {
        const requestPosition = new vscode.Position(13, 23);
        const referenceList = await getReferences(requestPosition);

        expect(referenceList.length).toEqual(2);
        expect(referenceList[0].uri.path).toContain('reference.cs');
        expect(referenceList[0].range).toStrictEqual(new vscode.Range(6, 20, 6, 23));

        expect(referenceList[1].uri.path).toContain('reference.cs');
        expect(referenceList[1].range).toStrictEqual(new vscode.Range(13, 22, 13, 25));
    });

    test('Finds references in other files', async () => {
        const requestPosition = new vscode.Position(14, 17);
        const referenceList = await getReferences(requestPosition);

        expect(referenceList.length).toEqual(2);
        expect(referenceList[0].uri.path).toContain('definition.cs');
        expect(referenceList[0].range).toStrictEqual(new vscode.Range(4, 25, 4, 35));

        expect(referenceList[1].uri.path).toContain('reference.cs');
        expect(referenceList[1].range).toStrictEqual(new vscode.Range(14, 17, 14, 27));
    });
});

async function getReferences(position: vscode.Position): Promise<vscode.Location[]> {
    const referenceList = <vscode.Location[]>(
        await vscode.commands.executeCommand(
            'vscode.executeReferenceProvider',
            vscode.window.activeTextEditor!.document.uri,
            position
        )
    );

    return sortLocations(referenceList);
}

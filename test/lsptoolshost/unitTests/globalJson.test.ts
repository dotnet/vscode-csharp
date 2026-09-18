/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { getWorkspaceConfiguration } from '../../fakes';
import { getValidatedDefaultGlobalJsonPath } from '../../../src/shared/globalJson';

describe('global.json tests', () => {
    let tempFolder: string;

    beforeEach(() => {
        tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-csharp-global-json-test-'));
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(getWorkspaceConfiguration());
        jest.replaceProperty(vscode.workspace, 'workspaceFolders', [
            { index: 0, name: 'Test', uri: vscode.Uri.file(tempFolder) },
        ]);
    });

    afterEach(() => {
        fs.rmSync(tempFolder, { force: true, recursive: true });
    });

    test('validates configured global.json', async () => {
        const dotnetFolder = path.join(tempFolder, 'dotnet');
        fs.mkdirSync(dotnetFolder);
        const globalJsonPath = path.join(dotnetFolder, 'global.json');
        fs.writeFileSync(globalJsonPath, '{}');
        const diagnostics: string[] = [];

        await vscode.workspace.getConfiguration().update('dotnet.defaultGlobalJson', 'dotnet/global.json');

        expect(getValidatedDefaultGlobalJsonPath((message) => diagnostics.push(message))).toEqual(globalJsonPath);
        expect(diagnostics).toHaveLength(0);
    });

    test('reports diagnostic when configured global.json does not exist', async () => {
        const diagnostics: string[] = [];

        await vscode.workspace.getConfiguration().update('dotnet.defaultGlobalJson', 'dotnet/global.json');

        expect(getValidatedDefaultGlobalJsonPath((message) => diagnostics.push(message))).toBeUndefined();
        expect(diagnostics).toEqual([
            `dotnet.defaultGlobalJson is set to '${path.join(
                tempFolder,
                'dotnet',
                'global.json'
            )}', but that path does not exist or cannot be accessed.`,
        ]);
    });

    test('reports diagnostic when configured path is not named global.json', async () => {
        const diagnostics: string[] = [];

        await vscode.workspace.getConfiguration().update('dotnet.defaultGlobalJson', 'dotnet/not-global.json');

        expect(getValidatedDefaultGlobalJsonPath((message) => diagnostics.push(message))).toBeUndefined();
        expect(diagnostics).toEqual([
            `dotnet.defaultGlobalJson is set to '${path.join(
                tempFolder,
                'dotnet',
                'not-global.json'
            )}', but the setting must point to a file named global.json.`,
        ]);
    });
});

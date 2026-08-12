/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import * as path from 'path';
import { commonOptions } from '../../../src/shared/options';
import { getWorkspaceConfiguration } from '../../fakes';

describe('Options tests', () => {
    beforeEach(() => {
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(getWorkspaceConfiguration());
    });

    test('Verify defaults', () => {
        expect(commonOptions.serverPath).toEqual('');
        expect(commonOptions.defaultSolution).toEqual('');
        expect(commonOptions.waitForDebugger).toEqual(false);
        expect(commonOptions.runSettingsPath).toEqual('');
    });

    test('BACK-COMPAT: "csharp.unitTestDebuggingOptions" is used if "dotnet.unitTestDebuggingOptions" is not set', async () => {
        await vscode.workspace.getConfiguration().update('csharp.unitTestDebuggingOptions', { old: true });

        expect(commonOptions.unitTestDebuggingOptions).toEqual({ old: true });
    });

    test('BACK-COMPAT: "csharp.unitTestDebuggingOptions" is not used if "dotnet.unitTestDebuggingOptions" is set', async () => {
        await vscode.workspace.getConfiguration().update('dotnet.unitTestDebuggingOptions', { new: true });
        await vscode.workspace.getConfiguration().update('csharp.unitTestDebuggingOptions', { old: true });

        expect(commonOptions.unitTestDebuggingOptions).toEqual({ new: true });
    });

    test('"dotnet.defaultSolution" is resolved relative to the workspace folder', async () => {
        const workspaceFolderUri = vscode.Uri.file('/Test');
        jest.replaceProperty(vscode.workspace, 'workspaceFolders', [
            { index: 0, name: 'Test', uri: workspaceFolderUri },
        ]);

        await vscode.workspace.getConfiguration().update('dotnet.defaultSolution', 'some_valid_solution.sln');

        expect(commonOptions.defaultSolution).toEqual(
            path.join(workspaceFolderUri.fsPath, 'some_valid_solution.sln')
        );
    });

    test('"dotnet.defaultSolution" can be disabled', async () => {
        jest.replaceProperty(vscode.workspace, 'workspaceFolders', [
            { index: 0, name: 'Test', uri: vscode.Uri.file('/Test') },
        ]);

        await vscode.workspace.getConfiguration().update('dotnet.defaultSolution', 'disable');

        expect(commonOptions.defaultSolution).toEqual('disable');
    });

    test('"dotnet.unitTests.runSettingsPath" is used if set', async () => {
        await vscode.workspace
            .getConfiguration()
            .update('dotnet.unitTests.runSettingsPath', 'some_valid_path\\some_valid_runsettings_files.runsettings');

        expect(commonOptions.runSettingsPath).toEqual(
            'some_valid_path\\some_valid_runsettings_files.runsettings'
        );
    });
});

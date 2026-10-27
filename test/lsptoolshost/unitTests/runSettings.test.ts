/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { getRunSettings } from '../../../src/lsptoolshost/testing/runSettings';
import { getWorkspaceConfiguration } from '../../fakes';

describe('getRunSettings', () => {
    const documentUri = 'file:///workspace/project/UnitTest1.cs';
    let workspaceDir: string;
    let runSettingsPath: string;
    let getWorkspaceFolder: jest.Mock<typeof vscode.workspace.getWorkspaceFolder>;
    let appendLine: jest.Mock<(value: string) => void>;
    let channel: vscode.OutputChannel;

    beforeEach(() => {
        workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runsettings-'));
        runSettingsPath = path.join(workspaceDir, '.runsettings');
        fs.writeFileSync(runSettingsPath, '<RunSettings />');
        appendLine = jest.fn();
        channel = { appendLine } as unknown as vscode.OutputChannel;

        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(getWorkspaceConfiguration());
        jest.spyOn(vscode.Uri, 'parse').mockImplementation((value: string) => ({ path: value }) as vscode.Uri);

        // The vscode fake doesn't implement getWorkspaceFolder, so provide it here.
        getWorkspaceFolder = jest.fn<typeof vscode.workspace.getWorkspaceFolder>(() => ({
            index: 0,
            name: 'workspace',
            uri: vscode.Uri.file(workspaceDir),
        }));
        Object.defineProperty(vscode.workspace, 'getWorkspaceFolder', {
            value: getWorkspaceFolder,
            configurable: true,
        });
    });

    afterEach(() => {
        fs.rmSync(workspaceDir, { recursive: true, force: true });
    });

    test('Undefined runsettings path is unchanged', () => {
        expect(getRunSettings(documentUri, channel)).toBeUndefined();
    });

    test('Absolute runsettings path is unchanged', async () => {
        await vscode.workspace.getConfiguration().update('dotnet.unitTests.runSettingsPath', runSettingsPath);

        expect(getRunSettings(documentUri, channel)).toEqual(runSettingsPath);
        expect(getWorkspaceFolder).not.toHaveBeenCalled();
    });

    test('Relative runsettings path is made absolute', async () => {
        await vscode.workspace.getConfiguration().update('dotnet.unitTests.runSettingsPath', '.runsettings');

        expect(getRunSettings(documentUri, channel)).toEqual(runSettingsPath);
    });

    test('Relative runsettings path outside a workspace folder is ignored', async () => {
        getWorkspaceFolder.mockReturnValue(undefined);
        await vscode.workspace.getConfiguration().update('dotnet.unitTests.runSettingsPath', '.runsettings');

        expect(getRunSettings(documentUri, channel)).toBeUndefined();
        expect(appendLine).toHaveBeenCalledWith(expect.stringContaining('Unable to find workspace folder'));
    });

    test('Missing runsettings file is ignored', async () => {
        await vscode.workspace
            .getConfiguration()
            .update('dotnet.unitTests.runSettingsPath', path.join(workspaceDir, 'missing.runsettings'));

        expect(getRunSettings(documentUri, channel)).toBeUndefined();
        expect(appendLine).toHaveBeenCalledWith(expect.stringContaining('Unable to find run settings file'));
    });
});

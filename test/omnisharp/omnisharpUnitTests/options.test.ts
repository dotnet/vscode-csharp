/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { URI } from 'vscode-uri';
import * as path from 'path';
import { commonOptions, omnisharpOptions } from '../../../src/shared/options';
import { getWorkspaceConfiguration } from '../../fakes';

describe('Options tests', () => {
    beforeEach(() => {
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(getWorkspaceConfiguration());
    });
    test('Verify defaults', () => {
        expect(commonOptions.serverPath).toEqual('');
        expect(omnisharpOptions.monoPath).toEqual('');
        expect(commonOptions.defaultSolution).toEqual('');
        expect(commonOptions.waitForDebugger).toEqual(false);
        expect(omnisharpOptions.loggingLevel).toEqual('information');
        expect(omnisharpOptions.autoStart).toEqual(true);
        expect(omnisharpOptions.projectLoadTimeout).toEqual(60);
        expect(omnisharpOptions.maxProjectResults).toEqual(250);
        expect(omnisharpOptions.useEditorFormattingSettings).toEqual(true);
        expect(omnisharpOptions.useFormatting).toEqual(true);
        expect(omnisharpOptions.showReferencesCodeLens).toEqual(true);
        expect(omnisharpOptions.showTestsCodeLens).toEqual(true);
        expect(omnisharpOptions.disableCodeActions).toEqual(false);
        expect(omnisharpOptions.showOmnisharpLogOnError).toEqual(true);
        expect(omnisharpOptions.minFindSymbolsFilterLength).toEqual(0);
        expect(omnisharpOptions.maxFindSymbolsItems).toEqual(1000);
        expect(omnisharpOptions.enableMsBuildLoadProjectsOnDemand).toEqual(false);
        expect(omnisharpOptions.enableRoslynAnalyzers).toEqual(true);
        expect(omnisharpOptions.enableEditorConfigSupport).toEqual(true);
        expect(omnisharpOptions.enableDecompilationSupport).toEqual(false);
        expect(omnisharpOptions.enableImportCompletion).toEqual(false);
        expect(omnisharpOptions.enableAsyncCompletion).toEqual(false);
        expect(omnisharpOptions.analyzeOpenDocumentsOnly).toEqual(true);
        expect(commonOptions.runSettingsPath).toEqual('');
    });

    test('Verify return no excluded paths when files.exclude empty', async () => {
        await vscode.workspace.getConfiguration().update('files.exclude', {});

        const excludedPaths = commonOptions.excludePaths;
        expect(excludedPaths).toHaveLength(0);
    });

    test('Verify return excluded paths when files.exclude populated', async () => {
        await vscode.workspace
            .getConfiguration()
            .update('files.exclude', { '**/node_modules': true, '**/assets': false });

        const excludedPaths = commonOptions.excludePaths;
        expect(excludedPaths).toStrictEqual(['**/node_modules']);
    });

    test('Verify return no excluded paths when files.exclude and search.exclude empty', async () => {
        await vscode.workspace.getConfiguration().update('files.exclude', {});
        await vscode.workspace.getConfiguration().update('search.exclude', {});

        const excludedPaths = commonOptions.excludePaths;
        expect(excludedPaths).toHaveLength(0);
    });

    test('BACK-COMPAT: "omnisharp.loggingLevel": "verbose" == "omnisharp.loggingLevel": "debug"', async () => {
        await vscode.workspace.getConfiguration().update('omnisharp.loggingLevel', 'verbose');

        expect(omnisharpOptions.loggingLevel).toEqual('debug');
    });

    test('BACK-COMPAT: "csharp.omnisharp" is used if it is set and "omnisharp.path" is not', async () => {
        await vscode.workspace.getConfiguration().update('csharp.omnisharp', 'OldPath');

        expect(commonOptions.serverPath).toEqual('OldPath');
    });

    test('BACK-COMPAT: "csharp.omnisharp" is not used if "omnisharp.path" is set', async () => {
        await vscode.workspace.getConfiguration().update('omnisharp.path', 'NewPath');
        await vscode.workspace.getConfiguration().update('csharp.omnisharp', 'OldPath');

        expect(commonOptions.serverPath).toEqual('NewPath');
    });

    test('"omnisharp.defaultLaunchSolution" is used if set', async () => {
        const workspaceFolderUri = URI.file('/Test');
        jest.replaceProperty(vscode.workspace, 'workspaceFolders', [
            { index: 0, name: 'Test', uri: workspaceFolderUri },
        ]);

        await vscode.workspace.getConfiguration().update('omnisharp.defaultLaunchSolution', 'some_valid_solution.sln');

        expect(commonOptions.defaultSolution).toEqual(path.join(workspaceFolderUri.fsPath, 'some_valid_solution.sln'));
    });

    test('"omnisharp.testRunSettings" is used if set', async () => {
        await vscode.workspace
            .getConfiguration()
            .update('omnisharp.testRunSettings', 'some_valid_path\\some_valid_runsettings_files.runsettings');

        expect(commonOptions.runSettingsPath).toEqual('some_valid_path\\some_valid_runsettings_files.runsettings');
    });
});

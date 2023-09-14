/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { URI } from 'vscode-uri';
import * as path from 'path';
import { commonOptions, omnisharpOptions } from '../../src/shared/options';
import { getWorkspaceConfiguration } from '../../test/unitTests/fakes';

describe('Options tests', () => {
    beforeEach(() => {
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(getWorkspaceConfiguration());
    });
    test('Verify defaults', () => {
        expect(commonOptions.serverPath.getValue(vscode)).toEqual('');
        expect(omnisharpOptions.monoPath.getValue(vscode)).toEqual('');
        expect(commonOptions.defaultSolution.getValue(vscode)).toEqual('');
        expect(commonOptions.waitForDebugger.getValue(vscode)).toEqual(false);
        expect(omnisharpOptions.loggingLevel.getValue(vscode)).toEqual('information');
        expect(omnisharpOptions.autoStart.getValue(vscode)).toEqual(true);
        expect(omnisharpOptions.projectLoadTimeout.getValue(vscode)).toEqual(60);
        expect(omnisharpOptions.maxProjectResults.getValue(vscode)).toEqual(250);
        expect(omnisharpOptions.useEditorFormattingSettings.getValue(vscode)).toEqual(true);
        expect(omnisharpOptions.useFormatting.getValue(vscode)).toEqual(true);
        expect(omnisharpOptions.showReferencesCodeLens.getValue(vscode)).toEqual(true);
        expect(omnisharpOptions.showTestsCodeLens.getValue(vscode)).toEqual(true);
        expect(omnisharpOptions.disableCodeActions.getValue(vscode)).toEqual(false);
        expect(omnisharpOptions.showOmnisharpLogOnError.getValue(vscode)).toEqual(true);
        expect(omnisharpOptions.minFindSymbolsFilterLength.getValue(vscode)).toEqual(0);
        expect(omnisharpOptions.maxFindSymbolsItems.getValue(vscode)).toEqual(1000);
        expect(omnisharpOptions.enableMsBuildLoadProjectsOnDemand.getValue(vscode)).toEqual(false);
        expect(omnisharpOptions.enableRoslynAnalyzers.getValue(vscode)).toEqual(true);
        expect(omnisharpOptions.enableEditorConfigSupport.getValue(vscode)).toEqual(true);
        expect(omnisharpOptions.enableDecompilationSupport.getValue(vscode)).toEqual(false);
        expect(omnisharpOptions.enableImportCompletion.getValue(vscode)).toEqual(false);
        expect(omnisharpOptions.enableAsyncCompletion.getValue(vscode)).toEqual(false);
        expect(omnisharpOptions.analyzeOpenDocumentsOnly.getValue(vscode)).toEqual(true);
        expect(commonOptions.runSettingsPath.getValue(vscode)).toEqual('');
    });

    test('Verify return no excluded paths when files.exclude empty', () => {
        vscode.workspace.getConfiguration().update('files.exclude', {});

        const excludedPaths = commonOptions.excludePaths.getValue(vscode);
        expect(excludedPaths).toHaveLength(0);
    });

    test('Verify return excluded paths when files.exclude populated', () => {
        vscode.workspace.getConfiguration().update('files.exclude', { '**/node_modules': true, '**/assets': false });

        const excludedPaths = commonOptions.excludePaths.getValue(vscode);
        expect(excludedPaths).toStrictEqual(['**/node_modules']);
    });

    test('Verify return no excluded paths when files.exclude and search.exclude empty', () => {
        vscode.workspace.getConfiguration().update('files.exclude', {});
        vscode.workspace.getConfiguration().update('search.exclude', {});

        const excludedPaths = commonOptions.excludePaths.getValue(vscode);
        expect(excludedPaths).toHaveLength(0);
    });

    test('BACK-COMPAT: "omnisharp.loggingLevel": "verbose" == "omnisharp.loggingLevel": "debug"', () => {
        vscode.workspace.getConfiguration().update('omnisharp.loggingLevel', 'verbose');

        expect(omnisharpOptions.loggingLevel.getValue(vscode)).toEqual('debug');
    });

    test('BACK-COMPAT: "csharp.omnisharp" is used if it is set and "omnisharp.path" is not', () => {
        vscode.workspace.getConfiguration().update('csharp.omnisharp', 'OldPath');

        expect(commonOptions.serverPath.getValue(vscode)).toEqual('OldPath');
    });

    test('BACK-COMPAT: "csharp.omnisharp" is not used if "omnisharp.path" is set', () => {
        vscode.workspace.getConfiguration().update('omnisharp.path', 'NewPath');
        vscode.workspace.getConfiguration().update('csharp.omnisharp', 'OldPath');

        expect(commonOptions.serverPath.getValue(vscode)).toEqual('NewPath');
    });

    test('"omnisharp.defaultLaunchSolution" is used if set', () => {
        const workspaceFolderUri = URI.file('/Test');
        jest.replaceProperty(vscode.workspace, 'workspaceFolders', [
            { index: 0, name: 'Test', uri: workspaceFolderUri },
        ]);

        vscode.workspace.getConfiguration().update('omnisharp.defaultLaunchSolution', 'some_valid_solution.sln');

        expect(commonOptions.defaultSolution.getValue(vscode)).toEqual(
            path.join(workspaceFolderUri.fsPath, 'some_valid_solution.sln')
        );
    });

    test('"omnisharp.testRunSettings" is used if set', () => {
        vscode.workspace
            .getConfiguration()
            .update('omnisharp.testRunSettings', 'some_valid_path\\some_valid_runsettings_files.runsettings');

        expect(commonOptions.runSettingsPath.getValue(vscode)).toEqual(
            'some_valid_path\\some_valid_runsettings_files.runsettings'
        );
    });
});

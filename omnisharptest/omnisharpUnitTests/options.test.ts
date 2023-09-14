/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { getVSCodeWithConfig, updateConfig } from '../../test/unitTests/fakes';
import { URI } from 'vscode-uri';
import * as path from 'path';
import { commonOptions, omnisharpOptions } from '../../src/shared/options';

suite('Options tests', () => {
    suiteSetup(() => should());

    test('Verify defaults', () => {
        const vscode = getVSCodeWithConfig();
        commonOptions.serverPath.getValue(vscode).should.equal('');
        omnisharpOptions.monoPath.getValue(vscode).should.equal('');
        commonOptions.defaultSolution.getValue(vscode).should.equal('');
        commonOptions.waitForDebugger.getValue(vscode).should.equal(false);
        omnisharpOptions.loggingLevel.getValue(vscode).should.equal('information');
        omnisharpOptions.autoStart.getValue(vscode).should.equal(true);
        omnisharpOptions.projectLoadTimeout.getValue(vscode).should.equal(60);
        omnisharpOptions.maxProjectResults.getValue(vscode).should.equal(250);
        omnisharpOptions.useEditorFormattingSettings.getValue(vscode).should.equal(true);
        omnisharpOptions.useFormatting.getValue(vscode).should.equal(true);
        omnisharpOptions.showReferencesCodeLens.getValue(vscode).should.equal(true);
        omnisharpOptions.showTestsCodeLens.getValue(vscode).should.equal(true);
        omnisharpOptions.disableCodeActions.getValue(vscode).should.equal(false);
        omnisharpOptions.showOmnisharpLogOnError.getValue(vscode).should.equal(true);
        omnisharpOptions.minFindSymbolsFilterLength.getValue(vscode).should.equal(0);
        omnisharpOptions.maxFindSymbolsItems.getValue(vscode).should.equal(1000);
        omnisharpOptions.enableMsBuildLoadProjectsOnDemand.getValue(vscode).should.equal(false);
        omnisharpOptions.enableRoslynAnalyzers.getValue(vscode).should.equal(true);
        omnisharpOptions.enableEditorConfigSupport.getValue(vscode).should.equal(true);
        omnisharpOptions.enableDecompilationSupport.getValue(vscode).should.equal(false);
        omnisharpOptions.enableImportCompletion.getValue(vscode).should.equal(false);
        omnisharpOptions.enableAsyncCompletion.getValue(vscode).should.equal(false);
        omnisharpOptions.analyzeOpenDocumentsOnly.getValue(vscode).should.equal(true);
        commonOptions.runSettingsPath.getValue(vscode).should.equal('');
    });

    test('Verify return no excluded paths when files.exclude empty', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, undefined, 'files.exclude', {});

        const excludedPaths = commonOptions.excludePaths.getValue(vscode);
        expect(excludedPaths).to.be.empty;
    });

    test('Verify return excluded paths when files.exclude populated', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, undefined, 'files.exclude', { '**/node_modules': true, '**/assets': false });

        const excludedPaths = commonOptions.excludePaths.getValue(vscode);
        excludedPaths.should.deep.equal(['**/node_modules']);
    });

    test('Verify return no excluded paths when files.exclude and search.exclude empty', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, undefined, 'files.exclude', {});
        updateConfig(vscode, undefined, 'search.exclude', {});

        const excludedPaths = commonOptions.excludePaths.getValue(vscode);
        expect(excludedPaths).to.be.empty;
    });

    test('Verify return excluded paths when files.exclude and search.exclude populated', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, undefined, 'files.exclude', { '/Library': true });
        updateConfig(vscode, undefined, 'search.exclude', { '**/node_modules': true, '**/assets': false });

        const excludedPaths = commonOptions.excludePaths.getValue(vscode);
        excludedPaths.should.deep.equal(['/Library', '**/node_modules']);
    });

    test('BACK-COMPAT: "omnisharp.loggingLevel": "verbose" == "omnisharp.loggingLevel": "debug"', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'omnisharp', 'loggingLevel', 'verbose');

        omnisharpOptions.loggingLevel.getValue(vscode).should.equal('debug');
    });

    test('BACK-COMPAT: "csharp.omnisharp" is used if it is set and "omnisharp.path" is not', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'csharp', 'omnisharp', 'OldPath');

        commonOptions.serverPath.getValue(vscode).should.equal('OldPath');
    });

    test('BACK-COMPAT: "csharp.omnisharp" is not used if "omnisharp.path" is set', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'omnisharp', 'path', 'NewPath');
        updateConfig(vscode, 'csharp', 'omnisharp', 'OldPath');

        commonOptions.serverPath.getValue(vscode).should.equal('NewPath');
    });

    test('"omnisharp.defaultLaunchSolution" is used if set', () => {
        const vscode = getVSCodeWithConfig();
        const workspaceFolderUri = URI.file('/Test');
        vscode.workspace.workspaceFolders = [{ index: 0, name: 'Test', uri: workspaceFolderUri }];

        updateConfig(vscode, 'omnisharp', 'defaultLaunchSolution', 'some_valid_solution.sln');

        commonOptions.defaultSolution
            .getValue(vscode)
            .should.equals(path.join(workspaceFolderUri.fsPath, 'some_valid_solution.sln'));
    });

    test('"omnisharp.testRunSettings" is used if set', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(
            vscode,
            'omnisharp',
            'testRunSettings',
            'some_valid_path\\some_valid_runsettings_files.runsettings'
        );

        commonOptions.runSettingsPath
            .getValue(vscode)
            .should.equal('some_valid_path\\some_valid_runsettings_files.runsettings');
    });
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { Options } from '../../src/shared/options';
import { getVSCodeWithConfig, updateConfig } from './testAssets/fakes';
import { URI } from 'vscode-uri';
import * as path from 'path';

suite('Options tests', () => {
    suiteSetup(() => should());

    test('Verify defaults', () => {
        const vscode = getVSCodeWithConfig();
        const options = Options.Read(vscode);
        options.commonOptions.serverPath.should.equal('');
        options.omnisharpOptions.monoPath.should.equal('');
        options.commonOptions.defaultSolution.should.equal('');
        options.commonOptions.waitForDebugger.should.equal(false);
        options.omnisharpOptions.loggingLevel.should.equal('information');
        options.omnisharpOptions.autoStart.should.equal(true);
        options.omnisharpOptions.projectLoadTimeout.should.equal(60);
        options.omnisharpOptions.maxProjectResults.should.equal(250);
        options.omnisharpOptions.useEditorFormattingSettings.should.equal(true);
        options.omnisharpOptions.useFormatting.should.equal(true);
        options.omnisharpOptions.showReferencesCodeLens.should.equal(true);
        options.omnisharpOptions.showTestsCodeLens.should.equal(true);
        options.omnisharpOptions.disableCodeActions.should.equal(false);
        options.omnisharpOptions.showOmnisharpLogOnError.should.equal(true);
        options.omnisharpOptions.minFindSymbolsFilterLength.should.equal(0);
        options.omnisharpOptions.maxFindSymbolsItems.should.equal(1000);
        options.omnisharpOptions.enableMsBuildLoadProjectsOnDemand.should.equal(false);
        options.omnisharpOptions.enableRoslynAnalyzers.should.equal(true);
        options.omnisharpOptions.enableEditorConfigSupport.should.equal(true);
        options.omnisharpOptions.enableDecompilationSupport.should.equal(false);
        options.omnisharpOptions.enableImportCompletion.should.equal(false);
        options.omnisharpOptions.enableAsyncCompletion.should.equal(false);
        options.omnisharpOptions.analyzeOpenDocumentsOnly.should.equal(true);
        options.omnisharpOptions.testRunSettings.should.equal('');
    });

    test('Verify return no excluded paths when files.exclude empty', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, undefined, 'files.exclude', {});

        const excludedPaths = Options.getExcludedPaths(vscode);
        expect(excludedPaths).to.be.empty;
    });

    test('Verify return excluded paths when files.exclude populated', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, undefined, 'files.exclude', { '**/node_modules': true, '**/assets': false });

        const excludedPaths = Options.getExcludedPaths(vscode);
        excludedPaths.should.deep.equal(['**/node_modules']);
    });

    test('Verify return no excluded paths when files.exclude and search.exclude empty', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, undefined, 'files.exclude', {});
        updateConfig(vscode, undefined, 'search.exclude', {});

        const excludedPaths = Options.getExcludedPaths(vscode, true);
        expect(excludedPaths).to.be.empty;
    });

    test('Verify return excluded paths when files.exclude and search.exclude populated', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, undefined, 'files.exclude', { '/Library': true });
        updateConfig(vscode, undefined, 'search.exclude', { '**/node_modules': true, '**/assets': false });

        const excludedPaths = Options.getExcludedPaths(vscode, true);
        excludedPaths.should.deep.equal(['/Library', '**/node_modules']);
    });

    test('BACK-COMPAT: "omnisharp.loggingLevel": "verbose" == "omnisharp.loggingLevel": "debug"', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'omnisharp', 'loggingLevel', 'verbose');

        const options = Options.Read(vscode);

        options.omnisharpOptions.loggingLevel.should.equal('debug');
    });

    test('BACK-COMPAT: "csharp.omnisharp" is used if it is set and "omnisharp.path" is not', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'csharp', 'omnisharp', 'OldPath');

        const options = Options.Read(vscode);

        options.commonOptions.serverPath.should.equal('OldPath');
    });

    test('BACK-COMPAT: "csharp.omnisharp" is not used if "omnisharp.path" is set', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'omnisharp', 'path', 'NewPath');
        updateConfig(vscode, 'csharp', 'omnisharp', 'OldPath');

        const options = Options.Read(vscode);

        options.commonOptions.serverPath.should.equal('NewPath');
    });

    test('"omnisharp.defaultLaunchSolution" is used if set', () => {
        const vscode = getVSCodeWithConfig();
        const workspaceFolderUri = URI.file('/Test');
        vscode.workspace.workspaceFolders = [{ index: 0, name: 'Test', uri: workspaceFolderUri }];

        updateConfig(vscode, 'omnisharp', 'defaultLaunchSolution', 'some_valid_solution.sln');

        const options = Options.Read(vscode);

        options.commonOptions.defaultSolution.should.equals(
            path.join(workspaceFolderUri.fsPath, 'some_valid_solution.sln')
        );
    });

    test('"omnisharp.testRunSettings" is used if set', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(
            vscode,
            'omnisharp',
            'testRunSettings',
            'some_valid_path\\some_valid_runsettings_files.runsettings'
        );

        const options = Options.Read(vscode);

        options.omnisharpOptions.testRunSettings.should.equal(
            'some_valid_path\\some_valid_runsettings_files.runsettings'
        );
    });
});

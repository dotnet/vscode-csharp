/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { Options } from '../../src/omnisharp/options';
import { getVSCodeWithConfig, updateConfig } from './testAssets/Fakes';

suite("Options tests", () => {
    suiteSetup(() => should());

    test('Verify defaults', () => {
        const vscode = getVSCodeWithConfig();
        const options = Options.Read(vscode);
        expect(options.path).to.be.null;
        options.useGlobalMono.should.equal("auto");
        expect(options.monoPath).to.be.undefined;
        options.waitForDebugger.should.equal(false);
        options.loggingLevel.should.equal("information");
        options.autoStart.should.equal(true);
        options.projectLoadTimeout.should.equal(60);
        options.maxProjectResults.should.equal(250);
        options.useEditorFormattingSettings.should.equal(true);
        options.useFormatting.should.equal(true);
        options.showReferencesCodeLens.should.equal(true);
        options.showTestsCodeLens.should.equal(true);
        options.disableCodeActions.should.equal(false);
        options.showOmnisharpLogOnError.should.equal(true);
        options.minFindSymbolsFilterLength.should.equal(0);
        options.maxFindSymbolsItems.should.equal(1000);
        options.enableMsBuildLoadProjectsOnDemand.should.equal(false);
        options.enableRoslynAnalyzers.should.equal(false);
        options.enableEditorConfigSupport.should.equal(false);
        options.enableDecompilationSupport.should.equal(false);
        options.enableImportCompletion.should.equal(false);
        expect(options.defaultLaunchSolution).to.be.undefined;
    });

    test('Verify return no excluded paths when files.exclude empty', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, null, 'files.exclude', {});

        const excludedPaths = Options.getExcludedPaths(vscode);
        expect(excludedPaths).to.be.empty;
    });

    test('Verify return excluded paths when files.exclude populated', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, null, 'files.exclude', { "**/node_modules": true, "**/assets": false });

        const excludedPaths = Options.getExcludedPaths(vscode);
        expect(excludedPaths).to.equalTo(["**/node_modules"]);
    });

    test('Verify return no excluded paths when files.exclude and search.exclude empty', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, null, 'files.exclude', {});
        updateConfig(vscode, null, 'search.exclude', {});

        const excludedPaths = Options.getExcludedPaths(vscode, true);
        expect(excludedPaths).to.be.empty;
    });

    test('Verify return excluded paths when files.exclude and search.exclude populated', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, null, 'files.exclude', { "/Library": true });
        updateConfig(vscode, null, 'search.exclude', { "**/node_modules": true, "**/assets": false });

        const excludedPaths = Options.getExcludedPaths(vscode, true);
        expect(excludedPaths).to.be.equalTo(["/Library", "**/node_modules"]);
    });

    test('BACK-COMPAT: "omnisharp.loggingLevel": "verbose" == "omnisharp.loggingLevel": "debug"', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'omnisharp', 'loggingLevel', "verbose");

        const options = Options.Read(vscode);

        options.loggingLevel.should.equal("debug");
    });

    test('BACK-COMPAT: "omnisharp.useMono": true == "omnisharp.useGlobalMono": "always"', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'omnisharp', 'useMono', true);

        const options = Options.Read(vscode);

        options.useGlobalMono.should.equal("always");
    });

    test('BACK-COMPAT: "omnisharp.useMono": false == "omnisharp.useGlobalMono": "auto"', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'omnisharp', 'useMono', false);

        const options = Options.Read(vscode);

        options.useGlobalMono.should.equal("auto");
    });

    test('BACK-COMPAT: "csharp.omnisharpUsesMono": true == "omnisharp.useGlobalMono": "always"', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'csharp', 'omnisharpUsesMono', true);

        const options = Options.Read(vscode);

        options.useGlobalMono.should.equal("always");
    });

    test('BACK-COMPAT: "csharp.omnisharpUsesMono": false == "omnisharp.useGlobalMono": "auto"', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'csharp', 'omnisharpUsesMono', false);

        const options = Options.Read(vscode);

        options.useGlobalMono.should.equal("auto");
    });

    test('BACK-COMPAT: "csharp.omnisharp" is used if it is set and "omnisharp.path" is not', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'csharp', 'omnisharp', 'OldPath');

        const options = Options.Read(vscode);

        options.path.should.equal("OldPath");
    });

    test('BACK-COMPAT: "csharp.omnisharp" is not used if "omnisharp.path" is set', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'omnisharp', 'path', 'NewPath');
        updateConfig(vscode, 'csharp', 'omnisharp', 'OldPath');

        const options = Options.Read(vscode);

        options.path.should.equal("NewPath");
    });

    test('"omnisharp.defaultLaunchSolution" is used if set', () => {
        const vscode = getVSCodeWithConfig();
        updateConfig(vscode, 'omnisharp', 'defaultLaunchSolution', 'some_valid_solution.sln');

        const options = Options.Read(vscode);

        options.defaultLaunchSolution.should.equal("some_valid_solution.sln");
    });
});

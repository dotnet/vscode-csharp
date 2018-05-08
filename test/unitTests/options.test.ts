/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { Options } from '../../src/omnisharp/options';
import { getWorkspaceConfiguration, getVSCodeWithConfig } from './testAssets/Fakes';


suite("Options tests", () => {
    suiteSetup(() => should());

    test('Verify defaults', () =>
    {
        const vscode = getVSCodeWithConfig();
        const options = Options.Read(vscode);

        expect(options.path).to.be.null;
        options.useGlobalMono.should.equal("auto");
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
    });

    test('BACK-COMPAT: "omnisharp.loggingLevel": "verbose" == "omnisharp.loggingLevel": "debug"', () =>
    {
        const omnisharpConfig = getWorkspaceConfiguration();
        omnisharpConfig.update('loggingLevel', "verbose");
        const vscode = getVSCodeWithConfig(omnisharpConfig);

        const options = Options.Read(vscode);

        options.loggingLevel.should.equal("debug");
    });

    test('BACK-COMPAT: "omnisharp.useMono": true == "omnisharp.useGlobalMono": "always"', () =>
    {
        const omnisharpConfig = getWorkspaceConfiguration();
        omnisharpConfig.update('useMono', true);
        const vscode = getVSCodeWithConfig(omnisharpConfig);

        const options = Options.Read(vscode);

        options.useGlobalMono.should.equal("always");
    });

    test('BACK-COMPAT: "omnisharp.useMono": false == "omnisharp.useGlobalMono": "auto"', () =>
    {
        const omnisharpConfig = getWorkspaceConfiguration();
        omnisharpConfig.update('useMono', false);
        const vscode = getVSCodeWithConfig(omnisharpConfig);

        const options = Options.Read(vscode);

        options.useGlobalMono.should.equal("auto");
    });

    test('BACK-COMPAT: "csharp.omnisharpUsesMono": true == "omnisharp.useGlobalMono": "always"', () =>
    {
        const csharpConfig = getWorkspaceConfiguration();
        csharpConfig.update('omnisharpUsesMono', true);
        const vscode = getVSCodeWithConfig(undefined, csharpConfig);

        const options = Options.Read(vscode);

        options.useGlobalMono.should.equal("always");
    });

    test('BACK-COMPAT: "csharp.omnisharpUsesMono": false == "omnisharp.useGlobalMono": "auto"', () =>
    {
        const csharpConfig = getWorkspaceConfiguration();
        csharpConfig.update('omnisharpUsesMono', false);
        const vscode = getVSCodeWithConfig(undefined, csharpConfig);

        const options = Options.Read(vscode);

        options.useGlobalMono.should.equal("auto");
    });

    test('BACK-COMPAT: "csharp.omnisharp" is used if it is set and "omnisharp.path" is not', () =>
    {
        const csharpConfig = getWorkspaceConfiguration();
        csharpConfig.update('omnisharp', 'OldPath');
        const vscode = getVSCodeWithConfig(undefined, csharpConfig);

        const options = Options.Read(vscode);

        options.path.should.equal("OldPath");
    });

    test('BACK-COMPAT: "csharp.omnisharp" is not used if "omnisharp.path" is set', () =>
    {
        const omnisharpConfig = getWorkspaceConfiguration();
        omnisharpConfig.update('path', 'NewPath');
        const csharpConfig = getWorkspaceConfiguration();
        csharpConfig.update('omnisharp', 'OldPath');
        const vscode = getVSCodeWithConfig(omnisharpConfig, csharpConfig);

        const options = Options.Read(vscode);

        options.path.should.equal("NewPath");
    });
});

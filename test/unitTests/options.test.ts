/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { Options } from '../../src/omnisharp/options';
import { getFakeVsCode, getWorkspaceConfiguration } from './testAssets/Fakes';

function getVSCode() {
    const vscode = getFakeVsCode();

    const omnisharpConfig = getWorkspaceConfiguration();
    const csharpConfig = getWorkspaceConfiguration();

    vscode.workspace.getConfiguration = (section?, resource?) =>
    {
        if (section === 'omnisharp')
        {
            return omnisharpConfig;
        }

        if (section === 'csharp')
        {
            return csharpConfig;
        }

        return undefined;
    };

    return vscode;
}

suite("Options tests", () => {
    suiteSetup(() => should());

    test('Construct options and verify defaults', () =>
    {
        const vscode = getVSCode();
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
        options.disableCodeActions.should.equal(false);
    });
});

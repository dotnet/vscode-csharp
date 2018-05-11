/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { getVSCodeWithConfig, updateConfig } from "./testAssets/Fakes";
import OptionStream from "../../src/observables/OptionStream";
import { vscode, ConfigurationChangeEvent } from "../../src/vscodeAdapter";
import Disposable from "../../src/Disposable";

suite('OptionStream', () => {
    suiteSetup(() => should());

    let vscode: vscode;
    let listenerFunction: Array<(e: ConfigurationChangeEvent) => any>;
    let optionStream: OptionStream;
    
    setup(() => {
        listenerFunction = new Array<(e: ConfigurationChangeEvent) => any>();
        vscode = getVSCode(listenerFunction);
        optionStream = new OptionStream(vscode);
    });

    test("Gives the default options if there is no change", () => {
        let options = optionStream.Options();
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

    test("Gives the latest options if there are changes in omnisharp config", () => {
        let changingConfig = "omnisharp";
        updateConfig(vscode, changingConfig, 'path', "somePath");
        listenerFunction.forEach(listener => listener(getConfigChangeEvent(changingConfig)));
        let options = optionStream.Options();
        expect(options.path).to.be.equal("somePath");
    });

    test("Gives the latest options if there are changes in omnisharp config", () => {
        let changingConfig = 'csharp';
        updateConfig(vscode, changingConfig, 'omnisharpUsesMono', true);
        listenerFunction.forEach(listener => listener(getConfigChangeEvent(changingConfig)));
        let options = optionStream.Options();
        expect(options.useGlobalMono).to.be.equal("always");
    });
});

function getVSCode(listenerFunction: Array<(e: ConfigurationChangeEvent) => any>): vscode {
    let vscode = getVSCodeWithConfig();
    vscode.workspace.onDidChangeConfiguration = (listener: (e: ConfigurationChangeEvent) => any, thisArgs?: any, disposables?: Disposable[]) => {
        listenerFunction.push(listener);
        return new Disposable(() => { });
    };

    return vscode;
}

function getConfigChangeEvent(changingConfig: string): ConfigurationChangeEvent {
    return {
        affectsConfiguration: (section: string) => section == changingConfig
    };
}
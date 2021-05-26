/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { use as chaiUse, expect, should } from 'chai';
import { updateConfig, getVSCodeWithConfig } from '../testAssets/Fakes';
import { timeout } from 'rxjs/operators';
import { from as observableFrom, Subject, BehaviorSubject } from 'rxjs';
import { vscode } from '../../../src/vscodeAdapter';
import { ShowOmniSharpConfigChangePrompt } from '../../../src/observers/OptionChangeObserver';
import { Options } from '../../../src/omnisharp/options';

chaiUse(require('chai-as-promised'));
chaiUse(require('chai-string'));

suite("OmniSharpConfigChangeObserver", () => {
    suiteSetup(() => should());

    let doClickOk: () => void;
    let doClickCancel: () => void;
    let signalCommandDone: () => void;
    let commandDone: Promise<void>;
    let vscode: vscode;
    let infoMessage: string;
    let invokedCommand: string;
    let optionObservable: Subject<Options>;

    setup(() => {
        vscode = getVSCode();
        optionObservable = new BehaviorSubject<Options>(Options.Read(vscode));
        ShowOmniSharpConfigChangePrompt(optionObservable, vscode);
        commandDone = new Promise<void>(resolve => {
            signalCommandDone = () => { resolve(); };
        });
    });

    [
        { config: "omnisharp", section: "path", value: "somePath" },
        { config: "omnisharp", section: "waitForDebugger", value: true },
        { config: "omnisharp", section: "enableMsBuildLoadProjectsOnDemand", value: true },
        { config: "omnisharp", section: "useGlobalMono", value: "always" },
        { config: "omnisharp", section: 'loggingLevel', value: 'verbose' }
    ].forEach(elem => {
        suite(`When the ${elem.config} ${elem.section} changes`, () => {
            setup(() => {
                expect(infoMessage).to.be.undefined;
                expect(invokedCommand).to.be.undefined;
                updateConfig(vscode, elem.config, elem.section, elem.value);
                optionObservable.next(Options.Read(vscode));
            });

            test(`The information message is shown`, async () => {
                expect(infoMessage).to.be.equal("OmniSharp configuration has changed. Would you like to relaunch the OmniSharp server with your changes?");
            });

            test('Given an information message if the user clicks cancel, the command is not executed', async () => {
                doClickCancel();
                await expect(observableFrom(commandDone).pipe(timeout(1)).toPromise()).to.be.rejected;
                expect(invokedCommand).to.be.undefined;
            });

            test('Given an information message if the user clicks Restore, the command is executed', async () => {
                doClickOk();
                await commandDone;
                expect(invokedCommand).to.be.equal("o.restart");
            });
        });
    });

    suite('Information Message is not shown on change in', () => {
        [
            { config: "csharp", section: 'disableCodeActions', value: true },
            { config: "csharp", section: 'testsCodeLens.enabled', value: false },
            { config: "omnisharp", section: 'referencesCodeLens.enabled', value: false },
            { config: "csharp", section: 'format.enable', value: false },
            { config: "omnisharp", section: 'useEditorFormattingSettings', value: false },
            { config: "omnisharp", section: 'maxProjectResults', value: 1000 },
            { config: "omnisharp", section: 'projectLoadTimeout', value: 1000 },
            { config: "omnisharp", section: 'autoStart', value: false }
        ].forEach(elem => {
            test(`${elem.config} ${elem.section}`, async () => {
                expect(infoMessage).to.be.undefined;
                expect(invokedCommand).to.be.undefined;
                updateConfig(vscode, elem.config, elem.section, elem.value);
                optionObservable.next(Options.Read(vscode));
                expect(infoMessage).to.be.undefined;
            });
        });
    });

    teardown(() => {
        infoMessage = undefined;
        invokedCommand = undefined;
        doClickCancel = undefined;
        doClickOk = undefined;
        signalCommandDone = undefined;
        commandDone = undefined;
    });

    function getVSCode(): vscode {
        let vscode = getVSCodeWithConfig();
        vscode.window.showInformationMessage = async <T>(message: string, ...items: T[]) => {
            infoMessage = message;
            return new Promise<T>(resolve => {
                doClickCancel = () => {
                    resolve(undefined);
                };

                doClickOk = () => {
                    resolve(items[0]);
                };
            });
        };

        vscode.commands.executeCommand = (command: string, ...rest: any[]) => {
            invokedCommand = command;
            signalCommandDone();
            return undefined;
        };

        return vscode;
    }
});

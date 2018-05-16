/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { use as chaiUse, expect, should } from 'chai';
import { updateConfig, getVSCodeWithConfig } from '../testAssets/Fakes';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/timeout';
import { vscode, ConfigurationChangeEvent } from '../../../src/vscodeAdapter';
import OptionStream from '../../../src/observables/OptionStream';
import Disposable from '../../../src/Disposable';
import { ShowOmniSharpConfigHasChanged } from '../../../src/observers/OptionChangeObserver';
import { GetConfigChangeEvent } from '../testAssets/GetConfigChangeEvent';

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
    let listenerFunction: Array<(e: ConfigurationChangeEvent) => any>;

    setup(() => {
        listenerFunction = new Array<(e: ConfigurationChangeEvent) => any>();
        vscode = getVSCodeWithConfig();
        vscode.window.showInformationMessage = async <T>(message: string, ...items: T[]) => {
            infoMessage = message;
            return new Promise<T>(resolve => {
                doClickCancel = () => {
                    resolve(undefined);
                };

                doClickOk = () => {
                    resolve(...items);
                };
            });
        };

        vscode.commands.executeCommand = (command: string, ...rest: any[]) => {
            invokedCommand = command;
            signalCommandDone();
            return undefined;
        };

        vscode.workspace.onDidChangeConfiguration = (listener: (e: ConfigurationChangeEvent) => any, thisArgs?: any, disposables?: Disposable[]) => {
            listenerFunction.push(listener);
            return new Disposable(() => { });
        };

        let optionStream = new OptionStream(vscode);
        ShowOmniSharpConfigHasChanged(optionStream, vscode);
        commandDone = new Promise<void>(resolve => {
            signalCommandDone = () => { resolve(); };
        });
    });

    suite('When there is a change in OmniSharp Config', () => {
        test('The information message is shown when the config changes', async () => {
            let changingConfig = "omnisharp";
            updateConfig(vscode, changingConfig, 'path', "somePath");
            listenerFunction.forEach(listener => listener(GetConfigChangeEvent(changingConfig)));
            expect(infoMessage).to.be.equal("OmniSharp configuration has changed. Would you like to relaunch the OmniSharp server with your changes?");
        });

        test('Given an information message if the user clicks cancel, the command is not executed', async () => {
            let changingConfig = "omnisharp";
            updateConfig(vscode, changingConfig, 'path', "somePath");
            listenerFunction.forEach(listener => listener(GetConfigChangeEvent(changingConfig)));
            doClickCancel();
            await expect(Observable.fromPromise(commandDone).timeout(1).toPromise()).to.be.rejected;
            expect(invokedCommand).to.be.undefined;
        });

        test('Given an information message if the user clicks Restore, the command is executed', async () => {
            let changingConfig = "omnisharp";
            updateConfig(vscode, changingConfig, 'path', "somePath");
            listenerFunction.forEach(listener => listener(GetConfigChangeEvent(changingConfig)));
            doClickOk();
            await commandDone;
            expect(invokedCommand).to.be.equal("o.restart");
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
});
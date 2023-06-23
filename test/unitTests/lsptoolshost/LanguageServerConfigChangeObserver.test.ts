/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { expect, should } from 'chai';
import { updateConfig, getVSCodeWithConfig } from '../testAssets/Fakes';
import { timeout } from 'rxjs/operators';
import { from as observableFrom, Subject, BehaviorSubject } from 'rxjs';
import { vscode } from '../../../src/vscodeAdapter';
import { ShowConfigChangePrompt } from '../../../src/shared/observers/OptionChangeObserver';
import { Options } from '../../../src/shared/options';

suite("LanguageServerConfigChangeObserver", () => {
    suiteSetup(() => should());

    let doClickOk: () => void;
    let doClickCancel: () => void;
    let signalCommandDone: () => void;
    let commandDone: Promise<void> | undefined;
    let vscode: vscode;
    let infoMessage: string | undefined;
    let invokedCommand: string | undefined;
    let optionObservable: Subject<Options>;

    setup(() => {
        vscode = getVSCode();
        optionObservable = new BehaviorSubject<Options>(Options.Read(vscode));
        ShowConfigChangePrompt(optionObservable, 'dotnet.restartServer', Options.shouldLanguageServerOptionChangeTriggerReload, vscode);
        commandDone = new Promise<void>(resolve => {
            signalCommandDone = () => { resolve(); };
        });
    });

    [
        { config: "dotnet", section: "server.documentSelector", value: ['other'] },
        { config: "dotnet", section: "server.trace", value: 'trace' },
    ].forEach(elem => {
        suite(`When the ${elem.config} ${elem.section} changes`, () => {
            setup(() => {
                expect(infoMessage).to.be.undefined;
                expect(invokedCommand).to.be.undefined;
                updateConfig(vscode, elem.config, elem.section, elem.value);
                optionObservable.next(Options.Read(vscode));
            });

            test(`The information message is shown`, async () => {
                expect(infoMessage).to.be.equal("C# configuration has changed. Would you like to relaunch the Language Server with your changes?");
            });

            test('Given an information message if the user clicks cancel, the command is not executed', async () => {
                doClickCancel();
                await expect(observableFrom(commandDone!).pipe(timeout(1)).toPromise()).to.be.rejected;
                expect(invokedCommand).to.be.undefined;
            });

            test('Given an information message if the user clicks Restore, the command is executed', async () => {
                doClickOk();
                await commandDone;
                expect(invokedCommand).to.be.equal('dotnet.restartServer');
            });
        });
    });

    suite('Information Message is not shown if no change in value', () => {
        [
            { config: "dotnet", section: "server.documentSelector", value: ['csharp'] },
            { config: "dotnet", section: "server.trace", value: 'Information' },
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

    suite('Information Message is not shown on change in', () => {
        [
            { config: "omnisharp", section: 'useModernNet', value: false },
            { config: "csharp", section: 'format.enable', value: false },
            { config: "files", section: 'exclude', value: false },
            { config: "search", section: 'exclude', value: 1000 },
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
        commandDone = undefined;
    });

    function getVSCode(): vscode {
        const vscode = getVSCodeWithConfig();
        vscode.window.showInformationMessage = async <T>(message: string, ...items: T[]) => {
            infoMessage = message;
            return new Promise<T | undefined>(resolve => {
                doClickCancel = () => {
                    resolve(undefined);
                };

                doClickOk = () => {
                    resolve(items[0]);
                };
            });
        };

        vscode.commands.executeCommand = async (command: string, ..._: any[]) => {
            invokedCommand = command;
            signalCommandDone();
            return undefined;
        };

        return vscode;
    }
});

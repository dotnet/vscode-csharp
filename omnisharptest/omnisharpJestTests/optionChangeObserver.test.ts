/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { timeout } from 'rxjs/operators';
import { from as observableFrom, Subject, BehaviorSubject } from 'rxjs';
import { Options } from '../../src/shared/options';
import { registerOmnisharpOptionChanges } from '../../src/omnisharp/omnisharpOptionChanges';

import * as jestLib from '@jest/globals';
import * as vscode from 'vscode';
import { getVSCodeWithConfig, updateConfig } from '../../test/unitTests/fakes';

jestLib.describe('OmniSharpConfigChangeObserver', () => {
    let doClickOk: () => void;
    let doClickCancel: () => void;
    let signalCommandDone: () => void;
    let commandDone: Promise<void> | undefined;
    let infoMessage: string | undefined;
    let invokedCommand: string | undefined;
    let optionObservable: Subject<Options>;

    jestLib.beforeEach(() => {
        resetMocks();
        optionObservable = new BehaviorSubject<Options>(Options.Read(vscode));
        infoMessage = undefined;
        invokedCommand = undefined;
        commandDone = new Promise<void>((resolve) => {
            signalCommandDone = () => {
                resolve();
            };
        });
        registerOmnisharpOptionChanges(optionObservable);
    });

    [
        { config: 'omnisharp', section: 'path', value: 'somePath' },
        { config: 'omnisharp', section: 'waitForDebugger', value: true },
        { config: 'omnisharp', section: 'enableMsBuildLoadProjectsOnDemand', value: true },
        { config: 'omnisharp', section: 'useModernNet', value: false },
        { config: 'omnisharp', section: 'loggingLevel', value: 'verbose' },
    ].forEach((elem) => {
        jestLib.describe(`When the ${elem.config} ${elem.section} changes`, () => {
            jestLib.beforeEach(() => {
                jestLib.expect(infoMessage).toBe(undefined);
                jestLib.expect(invokedCommand).toBe(undefined);
                updateConfig(vscode, elem.config, elem.section, elem.value);
                optionObservable.next(Options.Read(vscode));
            });

            jestLib.test(`The information message is shown`, async () => {
                jestLib
                    .expect(infoMessage)
                    .toEqual(
                        'C# configuration has changed. Would you like to relaunch the Language Server with your changes?'
                    );
            });

            jestLib.test(
                'Given an information message if the user clicks cancel, the command is not executed',
                async () => {
                    doClickCancel();
                    const from = observableFrom(commandDone!).pipe(timeout(1));
                    const fromPromise = from.toPromise();
                    await jestLib.expect(fromPromise).rejects.toThrow();
                    jestLib.expect(invokedCommand).toBe(undefined);
                }
            );

            jestLib.test(
                'Given an information message if the user clicks Reload, the command is executed',
                async () => {
                    doClickOk();
                    await commandDone;
                    jestLib.expect(invokedCommand).toEqual('o.restart');
                }
            );
        });
    });

    [{ config: 'dotnet', section: 'server.useOmnisharp', value: true }].forEach((elem) => {
        jestLib.describe(`When the ${elem.config} ${elem.section} changes`, () => {
            jestLib.beforeEach(() => {
                jestLib.expect(infoMessage).toBe(undefined);
                jestLib.expect(invokedCommand).toBe(undefined);
                updateConfig(vscode, elem.config, elem.section, elem.value);
                optionObservable.next(Options.Read(vscode));
            });

            jestLib.test(`The information message is shown`, async () => {
                jestLib
                    .expect(infoMessage)
                    .toEqual(
                        'dotnet.server.useOmnisharp option has changed. Please reload the window to apply the change'
                    );
            });

            jestLib.test(
                'Given an information message if the user clicks cancel, the command is not executed',
                async () => {
                    doClickCancel();
                    const from = observableFrom(commandDone!).pipe(timeout(1));
                    const fromPromise = from.toPromise();
                    await jestLib.expect(fromPromise).rejects.toThrow();
                    jestLib.expect(invokedCommand).toBe(undefined);
                }
            );

            jestLib.test(
                'Given an information message if the user clicks Reload, the command is executed',
                async () => {
                    doClickOk();
                    await commandDone;
                    jestLib.expect(invokedCommand).toEqual('workbench.action.reloadWindow');
                }
            );
        });
    });

    [
        { config: 'csharp', section: 'disableCodeActions', value: true },
        { config: 'csharp', section: 'testsCodeLens.enabled', value: false },
        { config: 'omnisharp', section: 'referencesCodeLens.enabled', value: false },
        { config: 'csharp', section: 'format.enable', value: false },
        { config: 'omnisharp', section: 'useEditorFormattingSettings', value: false },
        { config: 'omnisharp', section: 'maxProjectResults', value: 1000 },
        { config: 'omnisharp', section: 'projectLoadTimeout', value: 1000 },
        { config: 'omnisharp', section: 'autoStart', value: false },
    ].forEach((elem) => {
        jestLib.test(`Information Message is not shown on change in ${elem.config}.${elem.section}`, () => {
            jestLib.expect(infoMessage).toBe(undefined);
            jestLib.expect(invokedCommand).toBe(undefined);
            updateConfig(vscode, elem.config, elem.section, elem.value);
            optionObservable.next(Options.Read(vscode));
            jestLib.expect(infoMessage).toBe(undefined);
        });
    });

    function resetMocks() {
        vscode.window.showInformationMessage = async <T>(message: string, ...items: T[]) => {
            infoMessage = message;
            return new Promise<T | undefined>((resolve) => {
                doClickCancel = () => {
                    resolve(undefined);
                };

                doClickOk = () => {
                    resolve(items[0]);
                };
            });
        };
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        vscode.commands.executeCommand = async (command: string, ..._: any[]) => {
            invokedCommand = command;
            signalCommandDone();
            return undefined;
        };

        // This has to be replaced before every test to ensure that the config is reset.
        getVSCodeWithConfig(vscode);
    }
});

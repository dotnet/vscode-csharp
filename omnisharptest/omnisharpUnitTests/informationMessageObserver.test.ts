/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { InformationMessageObserver } from '../../src/observers/informationMessageObserver';
import { getUnresolvedDependenices, getWorkspaceConfiguration } from '../../test/unitTests/fakes';
import { Subject, from as observableFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

describe('InformationMessageObserver', () => {
    let doClickOk: () => void;
    let doClickCancel: () => void;
    let signalCommandDone: () => void;
    let commandDone: Promise<void> | undefined;
    const optionObservable = new Subject<void>();
    let infoMessage: string | undefined;
    let invokedCommand: string | undefined;
    const observer: InformationMessageObserver = new InformationMessageObserver(vscode);

    beforeEach(() => {
        infoMessage = undefined;
        invokedCommand = undefined;
        commandDone = new Promise<void>((resolve) => {
            signalCommandDone = () => {
                resolve();
            };
        });

        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(getWorkspaceConfiguration());
        jest.spyOn(vscode.window, 'showInformationMessage').mockImplementation(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            async <T>(message: string, ...items: T[]) => {
                infoMessage = message;
                return new Promise<T | undefined>((resolve) => {
                    doClickCancel = () => {
                        resolve(undefined);
                    };

                    doClickOk = () => {
                        resolve(items[0]);
                    };

                    return undefined;
                });
            }
        );
        jest.spyOn(vscode.commands, 'executeCommand').mockImplementation(async (command: string, ..._: any[]) => {
            invokedCommand = command;
            signalCommandDone();
            return undefined;
        });
    });

    [
        {
            event: getUnresolvedDependenices('someFile'),
            expectedCommand: 'dotnet.restore.all',
        },
    ].forEach((elem) => {
        describe(elem.event.constructor.name, () => {
            describe('Suppress Dotnet Restore Notification is true', () => {
                beforeEach(() => {
                    vscode.workspace.getConfiguration().update('csharp.suppressDotnetRestoreNotification', true);
                    optionObservable.next();
                });

                test('The information message is not shown', () => {
                    observer.post(elem.event);
                    expect(infoMessage).toBeUndefined();
                });
            });

            describe('Suppress Dotnet Restore Notification is false', () => {
                beforeEach(() => {
                    vscode.workspace.getConfiguration().update('csharp.suppressDotnetRestoreNotification', false);
                    optionObservable.next();
                });

                test('The information message is shown', async () => {
                    observer.post(elem.event);
                    expect(infoMessage?.length).toBeGreaterThan(0);
                    doClickOk();
                    await commandDone;
                    expect(invokedCommand).toEqual(elem.expectedCommand);
                });

                test('Given an information message if the user clicks Restore, the command is executed', async () => {
                    observer.post(elem.event);
                    doClickOk();
                    await commandDone;
                    expect(invokedCommand).toEqual(elem.expectedCommand);
                });

                test('Given an information message if the user clicks cancel, the command is not executed', async () => {
                    observer.post(elem.event);
                    doClickCancel();
                    await expect(observableFrom(commandDone!).pipe(timeout(1)).toPromise()).rejects.toThrow();
                    expect(invokedCommand).toBeUndefined();
                });
            });
        });
    });

    afterEach(() => {
        commandDone = undefined;
    });
});

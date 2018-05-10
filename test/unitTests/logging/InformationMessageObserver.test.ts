/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InformationMessageObserver } from '../../../src/observers/InformationMessageObserver';
import { use as chaiUse, expect, should } from 'chai';
import { getUnresolvedDependenices, updateConfig, getVSCodeWithConfig } from '../testAssets/Fakes';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/timeout';

chaiUse(require('chai-as-promised'));
chaiUse(require('chai-string'));

suite("InformationMessageObserver", () => {
    suiteSetup(() => should());

    let doClickOk: () => void;
    let doClickCancel: () => void;
    let signalCommandDone: () => void;
    let commandDone = new Promise<void>(resolve => {
        signalCommandDone = () => { resolve(); };
    });
    let vscode = getVsCode();
    let infoMessage: string;
    let relativePath: string;
    let invokedCommand: string;
    let observer: InformationMessageObserver = new InformationMessageObserver(vscode);

    setup(() => {
        infoMessage = undefined;
        relativePath = undefined;
        invokedCommand = undefined;
        commandDone = new Promise<void>(resolve => {
            signalCommandDone = () => { resolve(); };
        });
    });

    [
        {
            event: getUnresolvedDependenices("someFile"),
            expectedCommand: "dotnet.restore"
        }
    ].forEach((elem) => {
        suite(elem.event.constructor.name, () => {
            suite('Suppress Dotnet Restore Notification is true', () => {
                setup(() => updateConfig(vscode, 'csharp', 'suppressDotnetRestoreNotification', true));

                test('The information message is not shown', () => {
                    observer.post(elem.event);
                    expect(infoMessage).to.be.undefined;
                });
            });

            suite('Suppress Dotnet Restore Notification is false', () => {
                setup(() => updateConfig(vscode, 'csharp', 'suppressDotnetRestoreNotification', false));

                test('The information message is shown', async () => {
                    observer.post(elem.event);
                    expect(relativePath).to.not.be.empty;
                    expect(infoMessage).to.not.be.empty;
                    doClickOk();
                    await commandDone;
                    expect(invokedCommand).to.be.equal(elem.expectedCommand);
                });

                test('Given an information message if the user clicks Restore, the command is executed', async () => {
                    observer.post(elem.event);
                    doClickOk();
                    await commandDone;
                    expect(invokedCommand).to.be.equal(elem.expectedCommand);
                });

                test('Given an information message if the user clicks cancel, the command is not executed', async () => {
                    observer.post(elem.event);
                    doClickCancel();
                    await expect(Observable.fromPromise(commandDone).timeout(1).toPromise()).to.be.rejected;
                    expect(invokedCommand).to.be.undefined;
                });
            });
        });
    });

    function getVsCode() {
        let vscode = getVSCodeWithConfig();
        vscode.window.showInformationMessage = async (message: string, ...items: string[]) => {
            infoMessage = message;
            return new Promise<string>(resolve => {
                doClickCancel = () => {
                    resolve(undefined);
                };

                doClickOk = () => {
                    resolve(message);
                };
            });
        };

        vscode.commands.executeCommand = (command: string, ...rest: any[]) => {
            invokedCommand = command;
            signalCommandDone();
            return undefined;
        };

        vscode.workspace.asRelativePath = (pathOrUri?: string, includeWorspaceFolder?: boolean) => {
            relativePath = pathOrUri;
            return relativePath;
        };

        return vscode;
    }
});
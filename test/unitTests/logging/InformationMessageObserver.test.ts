/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InformationMessageObserver } from '../../../src/observers/InformationMessageObserver';
import { use as chaiUse, expect, should } from 'chai';
import { vscode, Uri } from '../../../src/vscodeAdapter';
import { getFakeVsCode, getNullWorkspaceConfiguration, getUnresolvedDependenices } from './Fakes';
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
    let vscode: vscode = getFakeVsCode();
    let infoMessage: string;
    let relativePath: string;
    let invokedCommand: string;
    let observer: InformationMessageObserver = new InformationMessageObserver(vscode);

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

    setup(() => {
        infoMessage = undefined;
        relativePath = undefined;
        invokedCommand = undefined;
        commandDone = new Promise<void>(resolve => {
            signalCommandDone = () => { resolve(); };
        });
    });

    suite('OmnisharpServerUnresolvedDependencies', () => {
        let event = getUnresolvedDependenices("someFile");

        suite('Suppress Dotnet Restore Notification is true', () => {
            setup(() => {
                vscode.workspace.getConfiguration = (section?: string, resource?: Uri) => {
                    return {
                        ...getNullWorkspaceConfiguration(),
                        get: <T>(section: string) => {
                            return true;// suppress the restore information
                        }
                    };
                };
            });

            test('The information message is not shown', () => {    
                observer.post(event);
                expect(infoMessage).to.be.undefined;
            });
        });
        
        suite('Suppress Dotnet Restore Notification is false', () => {
            setup(() => {
                vscode.workspace.getConfiguration = (section?: string, resource?: Uri) => {
                    return {
                        ...getNullWorkspaceConfiguration(),
                        get: <T>(section: string) => {
                            return false; // do not suppress the restore info
                        }
                    };
                };
            });

            test('The information message is shown', async () => {
                observer.post(event);
                expect(relativePath).to.not.be.empty;
                expect(infoMessage).to.not.be.empty;
                doClickOk();
                await commandDone;
                expect(invokedCommand).to.be.equal('dotnet.restore');
            });
        
            test('Given an information message if the user clicks Restore, the command is executed', async () => {
                observer.post(event);
                doClickOk();
                await commandDone;
                expect(invokedCommand).to.be.equal('dotnet.restore');
            });
        
            test('Given an information message if the user clicks cancel, the command is not executed', async () => {
                observer.post(event);
                doClickCancel();
                await expect(Observable.fromPromise(commandDone).timeout(1).toPromise()).to.be.rejected;
                expect(invokedCommand).to.be.undefined;
            });
        });   
    });
});
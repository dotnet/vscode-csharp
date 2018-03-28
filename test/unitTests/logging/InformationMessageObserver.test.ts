/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rx from 'rx';
import { InformationMessageObserver } from '../../../src/observers/InformationMessageObserver';
import { expect, should } from 'chai';
import { vscode, Uri } from '../../../src/vscodeAdapter';
import { getFakeVsCode, getNullWorkspaceConfiguration, getUnresolvedDependenices } from './Fakes';

suite("InformationMessageObserver", () => {
    suiteSetup(() => should()); 

    let doClickOk: () => void;
    let doClickCancel: () => void;
    let signalCommandDone: () => void;
    let commandDone = new Promise<void>(resolve => {
        signalCommandDone = () => { resolve(); };
    });
    let vscode: vscode = getFakeVsCode();
    let infoMessage;
    let relativePath;
    let invokedCommand;
    let observer: InformationMessageObserver =  new InformationMessageObserver(vscode);

    vscode.window.showInformationMessage = (message: string, ...items: string[]) => {
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

    vscode.workspace.asRelativePath = (pathOrUri?: string | Uri, includeWorspaceFolder? : boolean) => {
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

    test('If suppress dotnet configuration is set to true, the information message is not shown', () => {
        let event = getUnresolvedDependenices("someFile");
        vscode.workspace.getConfiguration = (section?: string, resource?: Uri) => {
            return {
                ...getNullWorkspaceConfiguration(),
                get: <T> (section: string) => {
                    return true;// suppress the restore information
            }};
        };
        observer.post(event);
        expect(infoMessage).to.be.undefined;
    });

    test('If suppress dotnet configuration is set to false, the information message is shown', async () => {
        let event = getUnresolvedDependenices("someFile");
        vscode.workspace.getConfiguration = (section?: string, resource?: Uri) => {
            return {
                ...getNullWorkspaceConfiguration(),
                get: <T> (section: string) => {
                    return false; // do not suppress the restore info
            }};
        };

        observer.post(event);
        expect(relativePath).to.not.be.empty;
        expect(infoMessage).to.not.be.empty;
        doClickOk();
        await commandDone;
        expect(invokedCommand).to.be.equal('dotnet.restore');
    });

    test('Given an information message if the user clicks Restore, the command is executed', async () => {
        let event = getUnresolvedDependenices("someFile");
        vscode.workspace.getConfiguration = (section?: string, resource?: Uri) => {
            return {
                ...getNullWorkspaceConfiguration(),
                get: <T> (section: string) => {
                    return false; // do not suppress the restore info
            }};
        };

        observer.post(event);
        doClickOk();
        await commandDone;
        expect(invokedCommand).to.be.equal('dotnet.restore');
    });

    
    test('Given an information message if the user clicks cancel, the command is not executed', async () => {
        let event = getUnresolvedDependenices("someFile");
        vscode.workspace.getConfiguration = (section?: string, resource?: Uri) => {
            return {
                ...getNullWorkspaceConfiguration(),
                get: <T> (section: string) => {
                    return false; // do not suppress the restore info
            }};
        };

        observer.post(event);
        doClickCancel();
        await expect(rx.Observable.fromPromise(commandDone).timeout(1).toPromise()).to.be.rejected;
        expect(invokedCommand).to.be.undefined;
    });
});
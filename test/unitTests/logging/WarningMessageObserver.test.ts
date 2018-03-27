/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rx from 'rx';
import { MessageItemWithCommand, WarningMessageObserver } from '../../../src/observers/WarningMessageObserver';
import { use as chaiUse, expect, should } from 'chai';
import { getFakeVsCode, getMSBuildDiagnosticsMessage, getOmnisharpMSBuildProjectDiagnosticsEvent, getOmnisharpServerOnErrorEvent } from './Fakes';
import { BaseEvent } from '../../../src/omnisharp/loggingEvents';
import { vscode } from '../../../src/vscodeAdapter';
import { Observable } from 'rx';

chaiUse(require('chai-as-promised'));
chaiUse(require('chai-string'));

suite('OmnisharpServerStatusObserver', () => {
    suiteSetup(() => should());

    let doClickOk: () => void;
    let doClickCancel: () => void;
    let signalCommandDone: () => void;
    let commandDone = new Promise<void>(resolve => {
        signalCommandDone = () => { resolve(); };
    });

    let warningMessage;
    let invokedCommand;
    let scheduler: rx.HistoricalScheduler;
    let observer: WarningMessageObserver;
    let vscode: vscode = getFakeVsCode();

    vscode.window.showWarningMessage = <T>(message, ...items) => {
        warningMessage = message;

        return new Promise<T>(resolve => {
            doClickCancel = () => {
                resolve(undefined);
            };

            doClickOk = () => {
                resolve(items[0]);
            };
        });
    };

    vscode.commands.executeCommand = <T>(command, ...rest) => {
        invokedCommand = command;
        signalCommandDone();
        return undefined;
    };

    setup(() => {
        scheduler = new rx.HistoricalScheduler(0, (x, y) => {
            return x > y ? 1 : -1;
        });
        observer = new WarningMessageObserver(vscode, scheduler);
        warningMessage = undefined;
        invokedCommand = undefined;
        commandDone = new Promise<void>(resolve => {
            signalCommandDone = () => { resolve(); };
        });
    });

    test('OmnisharpServerMsBuildProjectDiagnostics: No action is taken if the errors array is empty', () => {
        let event = getOmnisharpMSBuildProjectDiagnosticsEvent("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 0, 0, 0, 0)],
            []);
        observer.post(event);
        expect(invokedCommand).to.be.undefined;
    });

    [
        getOmnisharpMSBuildProjectDiagnosticsEvent("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 1, 2, 3, 4)],
            [getMSBuildDiagnosticsMessage("errorFile", "", "", 5, 6, 7, 8)]),
        getOmnisharpServerOnErrorEvent("someText", "someFile", 1, 2)
    ].forEach((event: BaseEvent) => {
        suite(`${event.constructor.name}`, () => {
            test(`When the event is fired then a warning message is displayed`, () => {
                observer.post(event);
                scheduler.advanceBy(1500); //since the debounce time is 1500 no output should be there
                expect(warningMessage).to.be.equal("Some projects have trouble loading. Please review the output for more details.");
            });

            test(`When events are fired rapidly, then they are debounced by 1500 ms`, () => {
                observer.post(event);
                scheduler.advanceBy(1000);
                expect(warningMessage).to.be.undefined;
                observer.post(event);
                scheduler.advanceBy(500);
                expect(warningMessage).to.be.undefined;
                scheduler.advanceBy(1000);
                expect(warningMessage).to.not.be.empty;
                //once there is a silence for 1500 ms the function will be invoked
            });

            test(`Given a warning message, when the user clicks ok the command is executed`, async () => {
                observer.post(event);
                scheduler.advanceBy(1500);
                doClickOk();
                await commandDone;
                expect(invokedCommand).to.be.equal("o.showOutput");
            });

            test(`Given a warning message, when the user clicks cancel the command is not executed`, async () => {
                observer.post(event);
                scheduler.advanceBy(1500);
                doClickCancel();
                await expect(Observable.fromPromise(commandDone).timeout(1).toPromise()).to.be.rejected;
                expect(invokedCommand).to.be.undefined;
            });
        });
    });
});
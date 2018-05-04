/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import OmniSharpConfigChangeObserver from "../../../src/observers/OmniSharpConfigChangeObserver";
import { getFakeVsCode } from "../testAssets/Fakes";
import { WorkspaceConfigurationChanged } from "../../../src/omnisharp/loggingEvents";

suite('OmniSharpConfigChangeObserver', () => {
    let vscode = getFakeVsCode();
    let observer: OmniSharpConfigChangeObserver;
    let warningMessage: string;
    let doClickOk: () => void;
    let doClickCancel: () => void;
    let signalCommandDone: () => void;
    let commandDone = new Promise<void>(resolve => {
        signalCommandDone = () => { resolve(); };
    });
    
    vscode.window.showWarningMessage = async <T>(message: string, ...items: T[]) => {
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

    vscode.commands.executeCommand = <T>(command: string, ...rest: any[]) => {
        invokedCommand = command;
        signalCommandDone();
        return <T>undefined;
    };
    suiteSetup(() => {
        observer = new OmniSharpConfigChangeObserver(vscode);
    });

     
    test('Shows the warning message when the config changes', () => {
        let event = new WorkspaceConfigurationChanged();
        observer.post(event);

    });
});
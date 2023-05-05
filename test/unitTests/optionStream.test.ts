/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import { ConfigurationChangeEvent, vscode } from "../../src/vscodeAdapter";
import { getVSCodeWithConfig, updateConfig } from "./testAssets/Fakes";
import Disposable from "../../src/Disposable";
import { Observable, Subscription } from "rxjs";
import { Options } from "../../src/shared/options";
import { GetConfigChangeEvent } from './testAssets/GetConfigChangeEvent';
import createOptionStream from '../../src/shared/observables/CreateOptionStream';

suite('OptionStream', () => {
    suiteSetup(() => should());

    let listenerFunction: Array<(e: ConfigurationChangeEvent) => any>;
    let vscode: vscode;
    let optionStream: Observable<Options>;
    let disposeCalled: boolean;

    setup(() => {
        listenerFunction = new Array<(e: ConfigurationChangeEvent) => any>();
        vscode = getVSCode(listenerFunction);
        optionStream = createOptionStream(vscode);
        disposeCalled = false;
    });

    suite('Returns the recent options to the subscriber', () => {
        let subscription: Subscription;
        let options: Options;

        setup(() => {
            subscription = optionStream.subscribe(newOptions => options = newOptions);
        });

        test('Gives the changed option when the omnisharp config changes', () => {
            options.commonOptions.serverPath.should.equal("");
            let changingConfig = "omnisharp";
            updateConfig(vscode, changingConfig, 'path', "somePath");
            listenerFunction.forEach(listener => listener(GetConfigChangeEvent(changingConfig)));
            options.commonOptions.serverPath.should.equal("somePath");
        });

        test('Gives the changed option when the csharp config changes', () => {
            options.omnisharpOptions.disableCodeActions.should.equal(false);
            let changingConfig = "csharp";
            updateConfig(vscode, changingConfig, 'disableCodeActions', true);
            listenerFunction.forEach(listener => listener(GetConfigChangeEvent(changingConfig)));
            options.omnisharpOptions.disableCodeActions.should.equal(true);
        });

        teardown(() => {
            options = undefined!;
            listenerFunction = undefined!;
            subscription.unsubscribe();
            subscription = undefined!;
        });
    });

    test('Dispose is called when the last subscriber unsubscribes', () => {
        disposeCalled.should.equal(false);
        let subscription1 = optionStream.subscribe(_ => { });
        let subscription2 = optionStream.subscribe(_ => { });
        let subscription3 = optionStream.subscribe(_ => { });
        subscription1.unsubscribe();
        disposeCalled.should.equal(false);
        subscription2.unsubscribe();
        disposeCalled.should.equal(false);
        subscription3.unsubscribe();
        disposeCalled.should.equal(true);
    });

    function getVSCode(listenerFunction: Array<(e: ConfigurationChangeEvent) => any>): vscode {
        let vscode = getVSCodeWithConfig();
        // @ts-ignore
        vscode.workspace.onDidChangeConfiguration = (listener: (e: ConfigurationChangeEvent) => any, thisArgs?: any, disposables?: Disposable[]) => {
            listenerFunction.push(listener);
            return new Disposable(() => disposeCalled = true);
        };

        return vscode;
    }
});

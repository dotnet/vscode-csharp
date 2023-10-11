/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { Observable } from 'rxjs';
import createOptionStream from '../../src/shared/observables/createOptionStream';
import Disposable from '../../src/disposable';

describe('OptionStream', () => {
    let listenerFunction: Array<(e: vscode.ConfigurationChangeEvent) => any>;
    let optionStream: Observable<void>;
    let disposeCalled: boolean;

    beforeEach(() => {
        listenerFunction = new Array<(e: vscode.ConfigurationChangeEvent) => any>();
        jest.spyOn(vscode.workspace, 'onDidChangeConfiguration').mockImplementation(
            (
                listener: (e: vscode.ConfigurationChangeEvent) => any,
                _thisArgs?: any,
                _disposables?: vscode.Disposable[]
            ) => {
                listenerFunction.push(listener);
                return new Disposable(() => (disposeCalled = true));
            }
        );

        optionStream = createOptionStream(vscode);
        disposeCalled = false;
    });

    test('Dispose is called when the last subscriber unsubscribes', () => {
        expect(disposeCalled).toEqual(false);
        const subscription1 = optionStream.subscribe((_) => {
            /** empty */
        });
        const subscription2 = optionStream.subscribe((_) => {
            /** empty */
        });
        const subscription3 = optionStream.subscribe((_) => {
            /** empty */
        });
        subscription1.unsubscribe();
        expect(disposeCalled).toEqual(false);
        subscription2.unsubscribe();
        expect(disposeCalled).toEqual(false);
        subscription3.unsubscribe();
        expect(disposeCalled).toEqual(true);
    });
});

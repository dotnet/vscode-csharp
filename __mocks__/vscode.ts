/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscodeAdapter from '../src/vscodeAdapter';
import { getFakeVsCode } from '../test/fakes';

// This module creates a manual mock for the vscode module for running in unit tests.
// Jest will automatically pick this up as it is in the __mocks__ directory next to node_modules.

// We can consider switching to an actual jest mock (instead of this manual fake) once we entirely
// remove the old test framework (mocha/chai).
class EventEmitter<T> {
    private readonly listeners: ((event: T) => void)[] = [];

    public readonly event = (listener: (event: T) => void) => {
        this.listeners.push(listener);
        return { dispose: () => this.listeners.splice(this.listeners.indexOf(listener), 1) };
    };

    public fire(event: T): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }

    public dispose(): void {
        this.listeners.length = 0;
    }
}

const vscode: vscodeAdapter.vscode & { EventEmitter: typeof EventEmitter } = Object.assign(getFakeVsCode(), {
    EventEmitter,
});
module.exports = vscode;

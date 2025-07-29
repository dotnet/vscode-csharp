/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventStream } from '../../../../src/eventStream';
import { BaseEvent } from '../../../../src/shared/loggingEvents';
import Disposable, { IDisposable } from '../../../../src/disposable';

export default class TestEventBus {
    private eventBus: Array<BaseEvent>;
    private disposable: IDisposable;

    constructor(eventStream: EventStream) {
        this.eventBus = [];
        this.disposable = new Disposable(eventStream.subscribe((event) => this.eventBus.push(event)));
    }

    public getEvents(): Array<BaseEvent> {
        return this.eventBus;
    }

    public dispose() {
        this.disposable.dispose();
    }
}

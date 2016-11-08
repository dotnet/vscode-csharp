/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Logger } from '../logger';
import * as protocol from './protocol';
import * as prioritization from './prioritization';

interface Request {
    path: string;
    data?: any;
    onSuccess(value: any): void;
    onError(err: any): void;
}

class RequestQueue {
    private _pending: Request[] = [];
    private _requests: Map<number, protocol.WireProtocol.RequestPacket> = new Map<number, protocol.WireProtocol.RequestPacket>();

    public constructor(
        private _maxSize: number,
        private _logger: Logger,
        private _makeRequest: (request: Request) => protocol.WireProtocol.RequestPacket) {
    }

    public enqueue(request: Request) {
        this._pending.push(request);
    }

    public remove(command: string, seq: number) {
        if (!this._requests.delete(seq)) {
            this._logger.appendLine(`Received response for ${command} but could not find request.`);
        }
    }

    public hasPending() {
        return this._pending.length === 0;
    }

    public isFull() {
        return this._requests.size >= this._maxSize;
    }

    public drain() {
        let i = 0;
        const slots = this._maxSize - this._requests.size;

        do {
            const item = this._pending.shift();
            const request = this._makeRequest(item);
            this._requests.set(request.Seq, request);

            if (this.isFull()) {
                return;
            }
        }
        while (this._pending.length > 0 && ++i < slots)
    }
}

export class Queue {
    private _isProcessing: boolean;
    private _priorityQueue: RequestQueue;
    private _normalQueue: RequestQueue;
    private _deferredQueue: RequestQueue;

    public constructor(
        logger: Logger,
        concurrency: number,
        makeRequest: (request: Request) => protocol.WireProtocol.RequestPacket
    ) {
        this._priorityQueue = new RequestQueue(1, logger, makeRequest);
        this._normalQueue = new RequestQueue(concurrency, logger, makeRequest);
        this._deferredQueue = new RequestQueue(Math.max(Math.floor(concurrency / 4), 2), logger, makeRequest);
    }

    private getQueue(command: string) {
        if (prioritization.isPriorityCommand(command)) {
            return this._priorityQueue;
        }
        else if (prioritization.isNormalCommand(command)) {
            return this._normalQueue;
        }
        else {
            return this._deferredQueue;
        }
    }

    public enqueue(request: Request) {
        const queue = this.getQueue(request.path);
        queue.enqueue(request);

        this.drain();
    }

    public remove(command: string, seq: number) {
        const queue = this.getQueue(command);
        queue.remove(command, seq);
    }

    private drain() {
        if (this._isProcessing) {
            return false;
        }

        if (this._priorityQueue.isFull()) {
            return false;
        }

        if (this._normalQueue.isFull() && this._deferredQueue.isFull()) {
            return false;
        }

        if (this._priorityQueue.hasPending()) {
            this._priorityQueue.drain();
            this._isProcessing = false;
            return;
        }

        if (this._normalQueue.hasPending()) {
            this._normalQueue.drain();
        }

        if (this._deferredQueue.hasPending()) {
            this._deferredQueue.drain();
        }

        this._isProcessing = false;
    }
}
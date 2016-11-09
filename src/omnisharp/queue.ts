/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Logger } from '../logger';
import * as protocol from './protocol';
import * as prioritization from './prioritization';

interface Request {
    command: string;
    data?: any;
    onSuccess(value: any): void;
    onError(err: any): void;
}

/**
 * This data structure manages a queue of requests that have been made and requests that have been
 * sent to the OmniSharp server and are waiting on a response.
 */
class RequestQueue {
    private _pending: Request[] = [];
    private _waiting: Map<number, protocol.WireProtocol.RequestPacket> = new Map<number, protocol.WireProtocol.RequestPacket>();

    public constructor(
        private _name: string,
        private _maxSize: number,
        private _logger: Logger,
        private _makeRequest: (request: Request) => protocol.WireProtocol.RequestPacket) {
    }

    /**
     * Enqueue a new request.
     */
    public enqueue(request: Request) {
        this._logger.appendLine(`Enqueuing request for ${request.command}.`);
        this._pending.push(request);
    }

    public dequeue(seq: number) {
        return this._waiting.delete(seq);
    }

    public delete(request: Request) {
        let index = this._pending.indexOf(request);
        if (index !== -1) {
            this._pending.splice(index, 1);

            // Do something better here.
            let err = new Error('Canceled');
            err.message = 'Canceled';
            request.onError(err);
        }
    }

    /**
     * Returns true if there are any requests pending to be sent to the OmniSharp server.
     */
    public hasPending() {
        return this._pending.length > 0;
    }

    /**
     * Returns true if the maximum number of requests waiting on the OmniSharp server has been reached.
     */
    public isFull() {
        return this._waiting.size >= this._maxSize;
    }

    /**
     * Process any pending requests and send them to the OmniSharp server.
     */
    public processPending() {
        if (this._pending.length === 0) {
            return;
        }

        const slots = this._maxSize - this._waiting.size;

        for (let i = 0; i < slots && this._pending.length > 0; i++) {
            const item = this._pending.shift();
            const request = this._makeRequest(item);
            this._waiting.set(request.Seq, request);

            if (this.isFull()) {
                return;
            }
        }
    }
}

export class Queue {
    private _logger: Logger;
    private _isProcessing: boolean;
    private _priorityQueue: RequestQueue;
    private _normalQueue: RequestQueue;
    private _deferredQueue: RequestQueue;

    public constructor(
        logger: Logger,
        concurrency: number,
        makeRequest: (request: Request) => protocol.WireProtocol.RequestPacket
    ) {
        this._priorityQueue = new RequestQueue('Priority', 1, logger, makeRequest);
        this._normalQueue = new RequestQueue('Normal', concurrency, logger, makeRequest);
        this._deferredQueue = new RequestQueue('Deferred', Math.max(Math.floor(concurrency / 4), 2), logger, makeRequest);
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
        const queue = this.getQueue(request.command);
        queue.enqueue(request);

        this.drain();
    }

    public dequeue(command: string, seq: number) {
        const queue = this.getQueue(command);
        return queue.dequeue(seq);
    }

    public cancelRequest(request: Request) {
        const queue = this.getQueue(request.command);
        queue.delete(request);
    }

    public drain() {
        if (this._isProcessing) {
            return false;
        }

        if (this._priorityQueue.isFull()) {
            return false;
        }

        if (this._normalQueue.isFull() && this._deferredQueue.isFull()) {
            return false;
        }

        this._isProcessing = true;

        if (this._priorityQueue.hasPending()) {
            this._priorityQueue.processPending();
            this._isProcessing = false;
            return;
        }

        if (this._normalQueue.hasPending()) {
            this._normalQueue.processPending();
        }

        if (this._deferredQueue.hasPending()) {
            this._deferredQueue.processPending();
        }

        this._isProcessing = false;
    }
}
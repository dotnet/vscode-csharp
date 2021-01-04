/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as prioritization from './prioritization';
import { OmnisharpServerProcessRequestComplete, OmnisharpServerProcessRequestStart, OmnisharpServerDequeueRequest, OmnisharpServerEnqueueRequest } from './loggingEvents';
import { EventStream } from '../EventStream';

export interface Request {
    command: string;
    data?: any;
    onSuccess(value: any): void;
    onError(err: any): void;
    startTime?: number;
    endTime?: number;
    id?: number;
}

/**
 * This data structure manages a queue of requests that have been made and requests that have been
 * sent to the OmniSharp server and are waiting on a response.
 */
class RequestQueue {
    private _pending: Request[] = [];
    private _waiting: Map<number, Request> = new Map<number, Request>();

    public constructor(
        private _name: string,
        private _maxSize: number,
        private eventStream: EventStream,
        private _makeRequest: (request: Request) => number) {
    }

    /**
     * Enqueue a new request.
     */
    public enqueue(request: Request) {
        this.eventStream.post(new OmnisharpServerEnqueueRequest(this._name, request.command));
        this._pending.push(request);
    }

    /**
     * Dequeue a request that has completed.
     */
    public dequeue(id: number) {
        const request = this._waiting.get(id);

        if (request) {
            this._waiting.delete(id);
            this.eventStream.post(new OmnisharpServerDequeueRequest(this._name, "waiting", request.command, id));
        }

        return request;
    }

    public cancelRequest(request: Request) {
        let index = this._pending.indexOf(request);
        if (index !== -1) {
            this._pending.splice(index, 1);
            this.eventStream.post(new OmnisharpServerDequeueRequest(this._name, "pending", request.command));
        }

        if (request.id){
            this.dequeue(request.id);
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

        const availableRequestSlots = this._maxSize - this._waiting.size;
        this.eventStream.post(new OmnisharpServerProcessRequestStart(this._name, availableRequestSlots));

        for (let i = 0; i < availableRequestSlots && this._pending.length > 0; i++) {
            const item = this._pending.shift();
            item.startTime = Date.now();

            const id = this._makeRequest(item);
            this._waiting.set(id, item);

            if (this.isFull()) {
                break;
            }
        }
        this.eventStream.post(new OmnisharpServerProcessRequestComplete());
    }
}

export class RequestQueueCollection {
    private _isProcessing: boolean;
    private _priorityQueue: RequestQueue;
    private _normalQueue: RequestQueue;
    private _deferredQueue: RequestQueue;

    public constructor(
        eventStream: EventStream,
        concurrency: number,
        makeRequest: (request: Request) => number
    ) {
        this._priorityQueue = new RequestQueue('Priority', 1, eventStream, makeRequest);
        this._normalQueue = new RequestQueue('Normal', concurrency, eventStream, makeRequest);
        this._deferredQueue = new RequestQueue('Deferred', Math.max(Math.floor(concurrency / 4), 2), eventStream, makeRequest);
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

    public isEmpty() {
        return !this._deferredQueue.hasPending()
            && !this._normalQueue.hasPending()
            && !this._priorityQueue.hasPending();
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
        queue.cancelRequest(request);
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
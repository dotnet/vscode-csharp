/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as protocol from '../protocol';
import * as utils from '../../common';
import { CancellationToken } from '../../vscodeAdapter';
import { ChildProcess, exec } from 'child_process';
import { LaunchTarget } from '../launcher';
import { ReadLine, createInterface } from 'readline';
import { Request, RequestQueueCollection } from '../requestQueue';
import { EventEmitter } from 'events';
import { LaunchInfo } from '../OmnisharpManager';
import { Options } from '../options';
import { PlatformInformation } from '../../platform';
import { launchOmniSharp } from '../launcher';
import { setTimeout } from 'timers';
import * as ObservableEvents from '../loggingEvents';
import { EventStream } from '../../EventStream';
import CompositeDisposable from '../../CompositeDisposable';
import Disposable from '../../Disposable';
import { IHostExecutableResolver } from '../../constants/IHostExecutableResolver';
import {
    removeBOMFromBuffer,
    removeBOMFromString,
} from '../../utils/removeBOM';
import { IEngine } from './IEngine';
import { Events } from '../server';

export class StdioEngine implements IEngine {
    private static _nextId = 1;
    private _readLine: ReadLine;
    private _disposables: CompositeDisposable;
    private _serverProcess: ChildProcess;
    private _eventBus: EventEmitter;
    private _requestQueue: RequestQueueCollection;

    constructor(
        eventBus: EventEmitter,
        private eventStream: EventStream,
        private platformInfo: PlatformInformation,
        private monoResolver: IHostExecutableResolver,
        private dotnetResolver: IHostExecutableResolver,
        disposables: CompositeDisposable
    ) {
        this._eventBus = eventBus;
        this._disposables = disposables;
        this._requestQueue = new RequestQueueCollection(
            this.eventStream,
            8,
            (request) => this._makeRequest(request)
        );
    }

    public async stop(): Promise<void> {
        let cleanupPromise: Promise<void>;

        if (!this._serverProcess) {
            // nothing to kill
            cleanupPromise = Promise.resolve();
        } else if (process.platform === 'win32') {
            // when killing a process in windows its child
            // processes are *not* killed but become root
            // processes. Therefore we use TASKKILL.EXE
            cleanupPromise = new Promise<void>((resolve, reject) => {
                const killer = exec(
                    `taskkill /F /T /PID ${this._serverProcess.pid}`,
                    (err, stdout, stderr) => {
                        if (err) {
                            return reject(err);
                        }
                    }
                );

                killer.on('exit', resolve);
                killer.on('error', reject);
            });
        } else {
            // Kill Unix process and children
            cleanupPromise = utils
                .getUnixChildProcessIds(this._serverProcess.pid)
                .then((children) => {
                    for (let child of children) {
                        process.kill(child, 'SIGTERM');
                    }

                    this._serverProcess.kill('SIGTERM');
                });
        }

        let disposables = this._disposables;
        this._disposables = null;

        return cleanupPromise.then(() => {
            this._serverProcess = null;
            this._eventBus.emit(Events.ServerStop, this);
            if (disposables) {
                disposables.dispose();
            }
        });
    }

    public async waitForInitialize(): Promise<void> {
        while (!this._requestQueue.isEmpty()) {
            let p = new Promise((resolve) => setTimeout(resolve, 100));
            await p;
        }
    }

    public addListener<T = {}>(
        event: string,
        listener: (e: T) => void
    ): Disposable {
        this._eventBus.addListener(event, listener);
        return new Disposable(() =>
            this._eventBus.removeListener(event, listener)
        );
    }

    public async start(
        cwd: string,
        args: string[],
        launchTarget: LaunchTarget,
        launchInfo: LaunchInfo,
        options: Options
    ): Promise<void> {
        const launchResult = await launchOmniSharp(
            cwd,
            args.concat('--encoding', 'utf-8'),
            launchInfo,
            this.platformInfo,
            options,
            this.monoResolver,
            this.dotnetResolver
        );
        this.eventStream.post(
            new ObservableEvents.OmnisharpLaunch(
                launchResult.hostVersion ?? '',
                launchResult.hostPath ?? '',
                launchResult.hostIsMono,
                launchResult.command,
                launchResult.process.pid
            )
        );

        this._serverProcess = launchResult.process;
        this._serverProcess.stderr.on('data', (data: Buffer) => {
            let trimData = removeBOMFromBuffer(data);
            if (trimData.length > 0) {
                this._fireEvent(Events.StdErr, trimData.toString());
            }
        });

        this._readLine = createInterface({
            input: this._serverProcess.stdout,
            output: this._serverProcess.stdin,
            terminal: false,
        });

        const promise = new Promise<void>((resolve, reject) => {
            let listener: Disposable;

            // Convert the timeout from the seconds to milliseconds, which is required by setTimeout().
            const timeoutDuration = options.projectLoadTimeout * 1000;

            // timeout logic
            const handle = setTimeout(() => {
                if (listener) {
                    listener.dispose();
                }

                reject(
                    new Error(
                        "OmniSharp server load timed out. Use the 'omnisharp.projectLoadTimeout' setting to override the default delay (one minute)."
                    )
                );
            }, timeoutDuration);

            // handle started-event
            listener = this.addListener(Events.Started, (e) => {
                if (listener) {
                    listener.dispose();
                }

                clearTimeout(handle);
                resolve();
            });
        });

        const lineReceived = this._onLineReceived.bind(this);

        this._readLine.addListener('line', lineReceived);

        this._disposables.add(
            new Disposable(() => {
                this._readLine.removeListener('line', lineReceived);
            })
        );

        await promise;

        this._requestQueue.drain();
    }

    private _onLineReceived(line: string) {
        line = removeBOMFromString(line);

        if (line[0] !== '{') {
            this.eventStream.post(
                new ObservableEvents.OmnisharpServerMessage(line)
            );
            return;
        }

        let packet: protocol.WireProtocol.Packet;
        try {
            packet = JSON.parse(line);
        } catch (err) {
            // This isn't JSON
            return;
        }

        if (!packet.Type) {
            // Bogus packet
            return;
        }

        switch (packet.Type) {
            case 'response':
                this._handleResponsePacket(
                    <protocol.WireProtocol.ResponsePacket>packet
                );
                break;
            case 'event':
                this._handleEventPacket(
                    <protocol.WireProtocol.EventPacket>packet
                );
                break;
            default:
                this.eventStream.post(
                    new ObservableEvents.OmnisharpServerMessage(
                        `Unknown packet type: ${packet.Type}`
                    )
                );
                break;
        }
    }

    private _handleResponsePacket(
        packet: protocol.WireProtocol.ResponsePacket
    ) {
        const request = this._requestQueue.dequeue(
            packet.Command,
            packet.Request_seq
        );

        if (!request) {
            this.eventStream.post(
                new ObservableEvents.OmnisharpServerMessage(
                    `Received response for ${packet.Command} but could not find request.`
                )
            );
            return;
        }

        this.eventStream.post(
            new ObservableEvents.OmnisharpServerVerboseMessage(
                `handleResponse: ${packet.Command} (${packet.Request_seq})`
            )
        );

        if (packet.Success) {
            request.onSuccess(packet.Body);
        } else {
            request.onError(packet.Message || packet.Body);
        }

        this._requestQueue.drain();
    }

    private _handleEventPacket(
        packet: protocol.WireProtocol.EventPacket
    ): void {
        if (packet.Event === 'log') {
            const entry = <{ LogLevel: string; Name: string; Message: string }>(
                packet.Body
            );
            this.eventStream.post(
                new ObservableEvents.OmnisharpEventPacketReceived(
                    entry.LogLevel,
                    entry.Name,
                    entry.Message
                )
            );
        } else {
            // fwd all other events
            this._fireEvent(packet.Event, packet.Body);
        }
    }

    private _fireEvent(event: string, args: any): void {
        this._eventBus.emit(event, args);
    }

    private _makeRequest(request: Request) {
        const id = StdioEngine._nextId++;

        const requestPacket: protocol.WireProtocol.RequestPacket = {
            Type: 'request',
            Seq: id,
            Command: request.command,
            Arguments: request.data,
        };

        this.eventStream.post(
            new ObservableEvents.OmnisharpRequestMessage(request, id)
        );
        this._serverProcess.stdin.write(JSON.stringify(requestPacket) + '\n');
        return id;
    }

    public dispose() {
        this._disposables?.dispose();
    }

    // --- requests et al
    public async makeRequest<TResponse>(
        command: string,
        data?: any,
        token?: CancellationToken
    ): Promise<TResponse> {
        let request: Request;

        let promise = new Promise<TResponse>((resolve, reject) => {
            request = {
                command,
                data,
                onSuccess: (value) => resolve(value),
                onError: (err) => reject(err),
            };

            this._requestQueue.enqueue({
                command,
                data,
                onSuccess: (value) => resolve(value),
                onError: (err) => reject(err),
            });
        });

        if (token) {
            token.onCancellationRequested(() => {
                this._requestQueue.cancelRequest(request);
            });
        }

        return promise;
    }
}

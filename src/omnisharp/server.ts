/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {EventEmitter} from 'events';
import {ChildProcess, exec} from 'child_process';
import {dirname} from 'path';
import {ReadLine, createInterface} from 'readline';
import {launchOmniSharp} from './launcher';
import * as protocol from './protocol';
import * as omnisharp from './omnisharp';
import * as download from './download';
import {readOptions} from './options';
import {Logger} from './logger';
import {DelayTracker} from './delayTracker';
import {LaunchTarget, findLaunchTargets, getDefaultFlavor} from './launcher';
import {Platform, getCurrentPlatform} from '../platform';
import TelemetryReporter from 'vscode-extension-telemetry';
import * as vscode from 'vscode';

enum ServerState {
    Starting,
    Started,
    Stopped
}

interface Request {
    path: string;
    data?: any;
    onSuccess(value: any): void;
    onError(err: any): void;
    _enqueued: number;
}

module Events {
    export const StateChanged = 'stateChanged';

    export const StdOut = 'stdout';
    export const StdErr = 'stderr';

    export const Error = 'Error';
    export const ServerError = 'ServerError';

    export const UnresolvedDependencies = 'UnresolvedDependencies';
    export const PackageRestoreStarted = 'PackageRestoreStarted';
    export const PackageRestoreFinished = 'PackageRestoreFinished';

    export const ProjectChanged = 'ProjectChanged';
    export const ProjectAdded = 'ProjectAdded';
    export const ProjectRemoved = 'ProjectRemoved';

    export const MsBuildProjectDiagnostics = 'MsBuildProjectDiagnostics';

    export const BeforeServerInstall = 'BeforeServerInstall';
    export const BeforeServerStart = 'BeforeServerStart';
    export const ServerStart = 'ServerStart';
    export const ServerStop = 'ServerStop';

    export const MultipleLaunchTargets = 'server:MultipleLaunchTargets';

    export const Started = 'started';
}

const TelemetryReportingDelay = 2 * 60 * 1000; // two minutes

export abstract class OmnisharpServer {

    private _reporter: TelemetryReporter;
    private _delayTrackers: { [requestName: string]: DelayTracker };
    private _telemetryIntervalId: NodeJS.Timer = undefined;

    private _eventBus = new EventEmitter();
    private _state: ServerState = ServerState.Stopped;
    private _launchTarget: LaunchTarget;
    private _queue: Request[] = [];
    private _isProcessingQueue = false;
    private _channel: vscode.OutputChannel;
    protected _logger: Logger;

    private _isDebugEnable: boolean = false;

    protected _serverProcess: ChildProcess;
    protected _extraArgs: string[];

    constructor(reporter: TelemetryReporter) {
        this._extraArgs = [];
        this._reporter = reporter;

        this._channel = vscode.window.createOutputChannel('OmniSharp Log');
        this._logger = new Logger(message => this._channel.append(message));
    }

    public isRunning(): boolean {
        return this._state === ServerState.Started;
    }

    private _getState(): ServerState {
        return this._state;
    }

    private _setState(value: ServerState): void {
        if (typeof value !== 'undefined' && value !== this._state) {
            this._state = value;
            this._fireEvent(Events.StateChanged, this._state);
        }
    }

    private _recordRequestDelay(requestName: string, elapsedTime: number) {
        let tracker = this._delayTrackers[requestName];
        if (!tracker) {
            tracker = new DelayTracker(requestName);
            this._delayTrackers[requestName] = tracker;
        }

        tracker.reportDelay(elapsedTime);
    }

    private _reportTelemetry() {
        const delayTrackers = this._delayTrackers;

        for (const path in delayTrackers) {
            const tracker = delayTrackers[path];
            const eventName = 'omnisharp' + path;
            if (tracker.hasMeasures()) {
                const measures = tracker.getMeasures();
                tracker.clearMeasures();

                this._reporter.sendTelemetryEvent(eventName, null, measures);
            }
        }
    }

    public getSolutionPathOrFolder(): string {
        return this._launchTarget
            ? this._launchTarget.target
            : undefined;
    }

    public getChannel(): vscode.OutputChannel {
        return this._channel;
    }

    public isDebugEnable(): boolean {
        return this._isDebugEnable;
    }

    // --- eventing

    public onStdout(listener: (e: string) => any, thisArg?: any) {
        return this._addListener(Events.StdOut, listener, thisArg);
    }

    public onStderr(listener: (e: string) => any, thisArg?: any) {
        return this._addListener(Events.StdErr, listener, thisArg);
    }

    public onError(listener: (e: protocol.ErrorMessage) => any, thisArg?: any) {
        return this._addListener(Events.Error, listener, thisArg);
    }

    public onServerError(listener: (err: any) => any, thisArg?: any) {
        return this._addListener(Events.ServerError, listener, thisArg);
    }

    public onUnresolvedDependencies(listener: (e: protocol.UnresolvedDependenciesMessage) => any, thisArg?: any) {
        return this._addListener(Events.UnresolvedDependencies, listener, thisArg);
    }

    public onBeforePackageRestore(listener: () => any, thisArg?: any) {
        return this._addListener(Events.PackageRestoreStarted, listener, thisArg);
    }

    public onPackageRestore(listener: () => any, thisArg?: any) {
        return this._addListener(Events.PackageRestoreFinished, listener, thisArg);
    }

    public onProjectChange(listener: (e: protocol.ProjectInformationResponse) => any, thisArg?: any) {
        return this._addListener(Events.ProjectChanged, listener, thisArg);
    }

    public onProjectAdded(listener: (e: protocol.ProjectInformationResponse) => any, thisArg?: any) {
        return this._addListener(Events.ProjectAdded, listener, thisArg);
    }

    public onProjectRemoved(listener: (e: protocol.ProjectInformationResponse) => any, thisArg?: any) {
        return this._addListener(Events.ProjectRemoved, listener, thisArg);
    }

    public onMsBuildProjectDiagnostics(listener: (e: protocol.MSBuildProjectDiagnostics) => any, thisArg?: any) {
        return this._addListener(Events.MsBuildProjectDiagnostics, listener, thisArg);
    }

    public onBeforeServerInstall(listener: () => any) {
        return this._addListener(Events.BeforeServerInstall, listener);
    }

    public onBeforeServerStart(listener: (e: string) => any) {
        return this._addListener(Events.BeforeServerStart, listener);
    }

    public onServerStart(listener: (e: string) => any) {
        return this._addListener(Events.ServerStart, listener);
    }

    public onServerStop(listener: () => any) {
        return this._addListener(Events.ServerStop, listener);
    }

    public onMultipleLaunchTargets(listener: (targets: LaunchTarget[]) => any, thisArg?: any) {
        return this._addListener(Events.MultipleLaunchTargets, listener, thisArg);
    }

    public onOmnisharpStart(listener: () => any) {
        return this._addListener(Events.Started, listener);
    }

    private _addListener(event: string, listener: (e: any) => any, thisArg?: any): vscode.Disposable {
        listener = thisArg ? listener.bind(thisArg) : listener;
        this._eventBus.addListener(event, listener);
        return new vscode.Disposable(() => this._eventBus.removeListener(event, listener));
    }

    protected _fireEvent(event: string, args: any): void {
        this._eventBus.emit(event, args);
    }

    // --- start, stop, and connect

    private _start(launchTarget: LaunchTarget): Promise<void> {
        const options = readOptions();

        let flavor: omnisharp.Flavor;
        if (options.path !== undefined && options.useMono === true) {
            flavor = omnisharp.Flavor.Mono;
        }
        else {
            flavor = getDefaultFlavor(launchTarget.kind);
        }

        return this._getServerPath(flavor).then(serverPath => {
            this._setState(ServerState.Starting);
            this._launchTarget = launchTarget;

            const solutionPath = launchTarget.target;
            const cwd = dirname(solutionPath);
            let args = [
                '-s', solutionPath,
                '--hostPID', process.pid.toString(),
                'DotNet:enablePackageRestore=false',
                '--encoding', 'utf-8'
            ];

            if (options.loggingLevel === 'verbose') {
                args.push('-v');
            }

            args = args.concat(this._extraArgs);

            this._logger.appendLine(`Starting OmniSharp server at ${new Date().toLocaleString()}`);
            this._logger.increaseIndent();
            this._logger.appendLine(`Target: ${solutionPath}`);
            this._logger.decreaseIndent();
            this._logger.appendLine();

            this._fireEvent(Events.BeforeServerStart, solutionPath);

            return launchOmniSharp({serverPath, flavor, cwd, args}).then(value => {
                if (value.usingMono) {
                    this._logger.appendLine(`OmniSharp server started wth Mono`);
                }
                else {
                    this._logger.appendLine(`OmniSharp server started`);
                }

                this._logger.increaseIndent();
                this._logger.appendLine(`Path: ${value.command}`);
                this._logger.appendLine(`PID: ${value.process.pid}`);
                this._logger.decreaseIndent();
                this._logger.appendLine();

                this._serverProcess = value.process;
                this._delayTrackers = {};
                this._setState(ServerState.Started);
                this._fireEvent(Events.ServerStart, solutionPath);

                return this._doConnect();
            }).then(() => {
                return vscode.commands.getCommands()
                    .then(commands => {
                        if (commands.find(c => c === 'vscode.startDebug')) {
                            this._isDebugEnable = true;
                        }
                    });
            }).then(() => {
                // Start telemetry reporting
                this._telemetryIntervalId = setInterval(() => this._reportTelemetry(), TelemetryReportingDelay);
            }).then(() => {
                this._processQueue();
            }, err => {
                this._fireEvent(Events.ServerError, err);
                this._setState(ServerState.Stopped);
                throw err;
            });
        });
    }

    protected abstract _doConnect(): Promise<void>;

    public stop(): Promise<void> {

        let ret: Promise<void>;

        if (this._telemetryIntervalId !== undefined) {
            // Stop reporting telemetry
            clearInterval(this._telemetryIntervalId);
            this._telemetryIntervalId = undefined;
            this._reportTelemetry();
        }

        if (!this._serverProcess) {
            // nothing to kill
            ret = Promise.resolve();
        }
        else if (process.platform === 'win32') {
            // when killing a process in windows its child
            // processes are *not* killed but become root
            // processes. Therefore we use TASKKILL.EXE
            ret = new Promise<void>((resolve, reject) => {
                const killer = exec(`taskkill /F /T /PID ${this._serverProcess.pid}`, (err, stdout, stderr) => {
                    if (err) {
                        return reject(err);
                    }
                });

                killer.on('exit', resolve);
                killer.on('error', reject);
            });
        }
        else {
            // Kill Unix process
            this._serverProcess.kill('SIGTERM');
            ret = Promise.resolve();
        }

        return ret.then(() => {
            this._serverProcess = null;
            this._setState(ServerState.Stopped);
            this._fireEvent(Events.ServerStop, this);
            return;
        });
    }

    public restart(launchTarget: LaunchTarget = this._launchTarget): Promise<void> {
        if (launchTarget) {
            return this.stop().then(() => {
                this._start(launchTarget);
            });
        }
    }

    public autoStart(preferredPath: string): Thenable<void> {
        return findLaunchTargets().then(launchTargets => {
            // If there aren't any potential launch targets, we create file watcher and
            // try to start the server again once a *.sln or project.json file is created.
            if (launchTargets.length === 0) {
                return new Promise<void>((resolve, reject) => {
                    // 1st watch for files
                    let watcher = vscode.workspace.createFileSystemWatcher('{**/*.sln,**/project.json}', false, true, true);
                    watcher.onDidCreate(uri => {
                        watcher.dispose();
                        resolve();
                    });
                }).then(() => {
                    // 2nd try again
                    return this.autoStart(preferredPath);
                });
            }

            // If there's more than one launch target, we start the server if one of the targets
            // matches the preferred path. Otherwise, we fire the "MultipleLaunchTargets" event,
            // which is handled in status.ts to display the launch target selector.
            if (launchTargets.length > 1 && preferredPath) {

                for (let launchTarget of launchTargets) {
                    if (launchTarget.target === preferredPath) {
                        // start preferred path
                        return this.restart(launchTarget);
                    }
                }

                this._fireEvent(Events.MultipleLaunchTargets, launchTargets);
                return Promise.reject<void>(undefined);
            }

            // If there's only one target, just start
            return this.restart(launchTargets[0]);
        });
    }

    private _getServerPath(flavor: omnisharp.Flavor): Promise<string> {
        // Attempt to find launch file path first from options, and then from the default install location.
        // If OmniSharp can't be found, download it.

        const options = readOptions();
        const installDirectory = omnisharp.getInstallDirectory(flavor);

        return new Promise<string>((resolve, reject) => {
            if (options.path) {
                return omnisharp.findServerPath(options.path).then(serverPath => {
                    return resolve(serverPath);
                }).catch(err => {
                    vscode.window.showWarningMessage(`Invalid value specified for "omnisharp.path" ('${options.path}).`);
                    return reject(err);
                });
            }

            return reject('No option specified.');
        }).catch(err => {
            return omnisharp.findServerPath(installDirectory);
        }).catch(err => {
            const platform = getCurrentPlatform();
            if (platform == Platform.Unknown && process.platform === 'linux') {
                this._channel.appendLine("[ERROR] Could not locate an OmniSharp server that supports your Linux distribution.");
                this._channel.appendLine("");
                this._channel.appendLine("OmniSharp provides a richer C# editing experience, with features like IntelliSense and Find All References.");
                this._channel.appendLine("It is recommend that you download the version of OmniSharp that runs on Mono using the following steps:");
                this._channel.appendLine("    1. If it's not already installed, download and install Mono (https://www.mono-project.com)");
                this._channel.appendLine("    2. Download and untar the latest OmniSharp Mono release from  https://github.com/OmniSharp/omnisharp-roslyn/releases/");
                this._channel.appendLine("    3. In Visual Studio Code, select Preferences->User Settings to open settings.json.");
                this._channel.appendLine("    4. In settings.json, add a new setting: \"omnisharp.path\": \"/path/to/omnisharp/OmniSharp.exe\"");
                this._channel.appendLine("    5. In settings.json, add a new setting: \"omnisharp.useMono\": true");
                this._channel.appendLine("    6. Restart Visual Studio Code.");
                this._channel.show();

                throw err;
            }

            const config = vscode.workspace.getConfiguration();
            const proxy = config.get<string>('http.proxy');
            const strictSSL = config.get('http.proxyStrictSSL', true);
            const logger = (message: string) => { this._logger.appendLine(message); };

            this._fireEvent(Events.BeforeServerInstall, this);

            return download.go(flavor, platform, this._logger, proxy, strictSSL).then(_ => {
                return omnisharp.findServerPath(installDirectory);
            });
        });
    }

    // --- requests et al

    public makeRequest<TResponse>(path: string, data?: any, token?: vscode.CancellationToken): Promise<TResponse> {

        if (this._getState() !== ServerState.Started) {
            return Promise.reject<TResponse>('server has been stopped or not started');
        }

        let startTime: number;
        let request: Request;

        let promise = new Promise<TResponse>((resolve, reject) => {
            startTime = Date.now();

            request = {
                path,
                data,
                onSuccess: value => resolve(value),
                onError: err => reject(err),
                _enqueued: Date.now()
            };

            this._queue.push(request);

            if (this._getState() === ServerState.Started && !this._isProcessingQueue) {
                this._processQueue();
            }
        });

        if (token) {
            token.onCancellationRequested(() => {
                let idx = this._queue.indexOf(request);
                if (idx !== -1) {
                    this._queue.splice(idx, 1);
                    let err = new Error('Canceled');
                    err.message = 'Canceled';
                    request.onError(err);
                }
            });
        }

        return promise.then(response => {
            let endTime = Date.now();
            let elapsedTime = endTime - startTime;
            this._recordRequestDelay(path, elapsedTime);

            return response;
        });
    }

    private _processQueue(): void {

        if (this._queue.length === 0) {
            // nothing to do
            this._isProcessingQueue = false;
            return;
        }

        // signal that we are working on it
        this._isProcessingQueue = true;

        // send next request and recurse when done
        const thisRequest = this._queue.shift();
        this._makeNextRequest(thisRequest.path, thisRequest.data).then(value => {
            thisRequest.onSuccess(value);
            this._processQueue();
        }, err => {
            thisRequest.onError(err);
            this._processQueue();
        }).catch(err => {
            console.error(err);
            this._processQueue();
        });
    }

    protected abstract _makeNextRequest(path: string, data: any): Promise<any>;
}

namespace WireProtocol {

    export interface Packet {
        Type: string;
        Seq: number;
    }

    export interface RequestPacket extends Packet {
        Command: string;
        Arguments: any;
    }

    export interface ResponsePacket extends Packet {
        Command: string;
        Request_seq: number;
        Running: boolean;
        Success: boolean;
        Message: string;
        Body: any;
    }

    export interface EventPacket extends Packet {
        Event: string;
        Body: any;
    }
}

export class StdioOmnisharpServer extends OmnisharpServer {

    private static _seqPool = 1;
    private static StartupTimeout = 1000 * 60;

    private _rl: ReadLine;
    private _activeRequest: { [seq: number]: { onSuccess: Function; onError: Function; } } = Object.create(null);
    private _callOnStop: Function[] = [];

    constructor(reporter: TelemetryReporter) {
        super(reporter);

        // extra argv
        this._extraArgs.push('--stdio');
    }

    public stop(): Promise<void> {
        while (this._callOnStop.length) {
            this._callOnStop.pop()();
        }

        return super.stop();
    }

    protected _doConnect(): Promise<void> {

        this._serverProcess.stderr.on('data', (data: any) => {
            this._fireEvent('stderr', String(data));
        });

        this._rl = createInterface({
            input: this._serverProcess.stdout,
            output: this._serverProcess.stdin,
            terminal: false
        });

        const p = new Promise<void>((resolve, reject) => {
            let listener: vscode.Disposable;

            // timeout logic
            const handle = setTimeout(() => {
                if (listener) {
                    listener.dispose();
                }

                reject(new Error('Failed to start OmniSharp'));
            }, StdioOmnisharpServer.StartupTimeout);

            // handle started-event
            listener = this.onOmnisharpStart(() => {
                if (listener) {
                    listener.dispose();
                }
                clearTimeout(handle);
                resolve();
            });
        });

        this._startListening();

        return p;
    }

    private _startListening(): void {

        const onLineReceived = (line: string) => {
            if (line[0] !== '{') {
                this._logger.appendLine(line);
                return;
            }

            let packet: WireProtocol.Packet;
            try {
                packet = JSON.parse(line);
            }
            catch (e) {
                // not json
                return;
            }

            if (!packet.Type) {
                // bogous packet
                return;
            }

            switch (packet.Type) {
                case 'response':
                    this._handleResponsePacket(<WireProtocol.ResponsePacket>packet);
                    break;
                case 'event':
                    this._handleEventPacket(<WireProtocol.EventPacket>packet);
                    break;
                default:
                    console.warn('unknown packet: ', packet);
                    break;
            }
        };

        this._rl.addListener('line', onLineReceived);
        this._callOnStop.push(() => this._rl.removeListener('line', onLineReceived));
    }

    private _handleResponsePacket(packet: WireProtocol.ResponsePacket): void {

        const requestSeq = packet.Request_seq,
            entry = this._activeRequest[requestSeq];

        if (!entry) {
            console.warn('Received a response WITHOUT a request', packet);
            return;
        }

        delete this._activeRequest[requestSeq];

        if (packet.Success) {
            entry.onSuccess(packet.Body);
        } else {
            entry.onError(packet.Message || packet.Body);
        }
    }

    private _handleEventPacket(packet: WireProtocol.EventPacket): void {

        if (packet.Event === 'log') {
            // handle log events
            const entry = <{ LogLevel: string; Name: string; Message: string; }>packet.Body;
            this._logger.appendLine(`[${entry.LogLevel}:${entry.Name}] ${entry.Message}`);
            return;
        } else {
            // fwd all other events
            this._fireEvent(packet.Event, packet.Body);
        }
    }

    protected _makeNextRequest(path: string, data: any): Promise<any> {

        const thisRequestPacket: WireProtocol.RequestPacket = {
            Type: 'request',
            Seq: StdioOmnisharpServer._seqPool++,
            Command: path,
            Arguments: data
        };

        return new Promise<any>((resolve, reject) => {

            this._activeRequest[thisRequestPacket.Seq] = {
                onSuccess: value => resolve(value),
                onError: err => reject(err)
            };

            this._serverProcess.stdin.write(JSON.stringify(thisRequestPacket) + '\n');
        });
    }
}

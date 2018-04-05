/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as protocol from './protocol';
import * as utils from '../common';
import * as vscode from 'vscode';
import * as serverUtils from '../omnisharp/utils';

import { ChildProcess, exec } from 'child_process';
import { LaunchTarget, findLaunchTargets } from './launcher';
import { ReadLine, createInterface } from 'readline';
import { Request, RequestQueueCollection } from './requestQueue';
import { DelayTracker } from './delayTracker';
import { EventEmitter } from 'events';
import { OmnisharpManager } from './OmnisharpManager';
import { Options } from './options';
import { PlatformInformation } from '../platform';
import { launchOmniSharp } from './launcher';
import { setTimeout } from 'timers';
import { OmnisharpDownloader } from './OmnisharpDownloader';
import * as ObservableEvents from './loggingEvents';
import { EventStream } from '../EventStream';
import { Disposable, CompositeDisposable, Subject } from 'rx';

enum ServerState {
    Starting,
    Started,
    Stopped
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

    export const TestMessage = 'TestMessage';

    export const BeforeServerInstall = 'BeforeServerInstall';
    export const BeforeServerStart = 'BeforeServerStart';
    export const ServerStart = 'ServerStart';
    export const ServerStop = 'ServerStop';

    export const MultipleLaunchTargets = 'server:MultipleLaunchTargets';

    export const Started = 'started';
}

const TelemetryReportingDelay = 2 * 60 * 1000; // two minutes
const serverUrl = "https://roslynomnisharp.blob.core.windows.net";
const installPath = ".omnisharp/experimental";
const latestVersionFileServerPath = 'releases/versioninfo.txt';

export class OmniSharpServer {

    private static _nextId = 1;
    private _readLine: ReadLine;
    private _disposables: CompositeDisposable;

    private _delayTrackers: { [requestName: string]: DelayTracker };
    private _telemetryIntervalId: NodeJS.Timer = undefined;

    private _eventBus = new EventEmitter();
    private _state: ServerState = ServerState.Stopped;
    private _launchTarget: LaunchTarget;
    private _requestQueue: RequestQueueCollection;
    private _serverProcess: ChildProcess;
    private _options: Options;

    private _omnisharpManager: OmnisharpManager;
    private eventStream: EventStream;
    private updateProjectDebouncer = new Subject<ObservableEvents.ProjectModified>();
    private firstUpdateProject: boolean;

    constructor(eventStream: EventStream, packageJSON: any, platformInfo: PlatformInformation) {
        this.eventStream = eventStream;
        this._requestQueue = new RequestQueueCollection(this.eventStream, 8, request => this._makeRequest(request));
        let downloader = new OmnisharpDownloader(this.eventStream, packageJSON, platformInfo);
        this._omnisharpManager = new OmnisharpManager(downloader, platformInfo);
        this.updateProjectDebouncer.debounce(1500).subscribe((event) => { this.updateProjectInfo(); });
        this.firstUpdateProject = true;
    }

    public isRunning(): boolean {
        return this._state === ServerState.Started;
    }

    public async waitForEmptyEventQueue(): Promise<void> {
        while (!this._requestQueue.isEmpty()) {
            let p = new Promise((resolve) => setTimeout(resolve, 100));
            await p;
        }
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

        for (const requestName in delayTrackers) {
            const tracker = delayTrackers[requestName];
            const eventName = 'omnisharp' + requestName;
            if (tracker.hasMeasures()) {
                const measures = tracker.getMeasures();
                tracker.clearMeasures();

                this.eventStream.post(new ObservableEvents.OmnisharpDelayTrackerEventMeasures(eventName, measures));
            }
        }
    }

    public getSolutionPathOrFolder(): string {
        return this._launchTarget
            ? this._launchTarget.target
            : undefined;
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

    public onTestMessage(listener: (e: protocol.V2.TestMessageEvent) => any, thisArg?: any) {
        return this._addListener(Events.TestMessage, listener, thisArg);
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

    private _addListener(event: string, listener: (e: any) => any, thisArg?: any): Disposable {
        listener = thisArg ? listener.bind(thisArg) : listener;
        this._eventBus.addListener(event, listener);
        return Disposable.create(() => this._eventBus.removeListener(event, listener));
    }

    protected _fireEvent(event: string, args: any): void {
        this._eventBus.emit(event, args);
    }

    // --- start, stop, and connect

    private async _start(launchTarget: LaunchTarget): Promise<void> {

        this._disposables = new CompositeDisposable();

        this._disposables.add(this.onServerError(err =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnServerError(err))
        ));

        this._disposables.add(this.onError((message: protocol.ErrorMessage) =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnError(message))
        ));

        this._disposables.add(this.onMsBuildProjectDiagnostics((message: protocol.MSBuildProjectDiagnostics) =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerMsBuildProjectDiagnostics(message))
        ));

        this._disposables.add(this.onUnresolvedDependencies((message: protocol.UnresolvedDependenciesMessage) =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerUnresolvedDependencies(message))
        ));

        this._disposables.add(this.onStderr((message: string) =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnStdErr(message))
        ));

        this._disposables.add(this.onMultipleLaunchTargets((targets: LaunchTarget[]) =>
            this.eventStream.post(new ObservableEvents.OmnisharpOnMultipleLaunchTargets(targets))
        ));

        this._disposables.add(this.onBeforeServerInstall(() =>
            this.eventStream.post(new ObservableEvents.OmnisharpOnBeforeServerInstall())
        ));

        this._disposables.add(this.onBeforeServerStart(() => {
            this.eventStream.post(new ObservableEvents.OmnisharpOnBeforeServerStart());
        }));

        this._disposables.add(this.onServerStop(() =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnStop())
        ));

        this._disposables.add(this.onServerStart(() => {
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnStart());
        }));

        this._disposables.add(this.onProjectAdded(this.updateTracker));
        this._disposables.add(this.onProjectChange(this.updateTracker));
        this._disposables.add(this.onProjectRemoved(this.updateTracker)); 

        this._setState(ServerState.Starting);
        this._launchTarget = launchTarget;

        const solutionPath = launchTarget.target;
        const cwd = path.dirname(solutionPath);
        this._options = Options.Read();

        let args = [
            '-s', solutionPath,
            '--hostPID', process.pid.toString(),
            '--stdio',
            'DotNet:enablePackageRestore=false',
            '--encoding', 'utf-8',
            '--loglevel', this._options.loggingLevel
        ];

        if (this._options.waitForDebugger === true) {
            args.push('--debug');
        }

        let launchPath: string;
        if (this._options.path) {
            try {
                let extensionPath = utils.getExtensionPath();
                launchPath = await this._omnisharpManager.GetOmnisharpPath(this._options.path, this._options.useMono, serverUrl, latestVersionFileServerPath, installPath, extensionPath);
            }
            catch (error) {
                this.eventStream.post(new ObservableEvents.OmnisharpFailure(`Error occured in loading omnisharp from omnisharp.path\nCould not start the server due to ${error.toString()}`, error));
                return;
            }
        }

        this.eventStream.post(new ObservableEvents.OmnisharpInitialisation(new Date(), solutionPath));
        this._fireEvent(Events.BeforeServerStart, solutionPath);

        return launchOmniSharp(cwd, args, launchPath).then(value => {
            this.eventStream.post(new ObservableEvents.OmnisharpLaunch(value.usingMono, value.command, value.process.pid));

            this._serverProcess = value.process;
            this._delayTrackers = {};
            this._setState(ServerState.Started);
            this._fireEvent(Events.ServerStart, solutionPath);

            return this._doConnect();
        }).then(() => {
            // Start telemetry reporting
            this._telemetryIntervalId = setInterval(() => this._reportTelemetry(), TelemetryReportingDelay);
        }).then(() => {
            this._requestQueue.drain();
        }).catch(err => {
            this._fireEvent(Events.ServerError, err);
            return this.stop();
        });
    }

    private updateTracker = () => {
        if (this.firstUpdateProject) {
            this.updateProjectInfo();
        }
        else {
            this.updateProjectDebouncer.onNext(new ObservableEvents.ProjectModified());
        }
    }

    private updateProjectInfo = async () => {
        this.firstUpdateProject = false;
        let info = await serverUtils.requestWorkspaceInformation(this);
        //once we get the info, push the event into the event stream
        this.eventStream.post(new ObservableEvents.WorkspaceInformationUpdated(info));
    }

    public stop(): Promise<void> {

        let cleanupPromise: Promise<void>;

        if (this._telemetryIntervalId !== undefined) {
            // Stop reporting telemetry
            clearInterval(this._telemetryIntervalId);
            this._telemetryIntervalId = undefined;
            this._reportTelemetry();
        }

        if (!this._serverProcess) {
            // nothing to kill
            cleanupPromise = Promise.resolve();
        }
        else if (process.platform === 'win32') {
            // when killing a process in windows its child
            // processes are *not* killed but become root
            // processes. Therefore we use TASKKILL.EXE
            cleanupPromise = new Promise<void>((resolve, reject) => {
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
            // Kill Unix process and children
            cleanupPromise = utils.getUnixChildProcessIds(this._serverProcess.pid)
                .then(children => {
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
            this._setState(ServerState.Stopped);
            this._fireEvent(Events.ServerStop, this);
            disposables.dispose();
        });
    }

    public async restart(launchTarget: LaunchTarget = this._launchTarget): Promise<void> {
        if (launchTarget) {
            await this.stop();
            await this._start(launchTarget);
        }
    }

    public autoStart(preferredPath: string): Thenable<void> {
        return findLaunchTargets().then(launchTargets => {
            // If there aren't any potential launch targets, we create file watcher and try to
            // start the server again once a *.sln, *.csproj, project.json, CSX or Cake file is created.
            if (launchTargets.length === 0) {
                return new Promise<void>((resolve, reject) => {
                    // 1st watch for files
                    let watcher = vscode.workspace.createFileSystemWatcher('{**/*.sln,**/*.csproj,**/project.json,**/*.csx,**/*.cake}',
                        /*ignoreCreateEvents*/ false,
                        /*ignoreChangeEvents*/ true,
                        /*ignoreDeleteEvents*/ true);

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

    // --- requests et al

    public makeRequest<TResponse>(command: string, data?: any, token?: vscode.CancellationToken): Promise<TResponse> {

        if (this._getState() !== ServerState.Started) {
            return Promise.reject<TResponse>('server has been stopped or not started');
        }

        let startTime: number;
        let request: Request;

        let promise = new Promise<TResponse>((resolve, reject) => {
            startTime = Date.now();

            request = {
                command,
                data,
                onSuccess: value => resolve(value),
                onError: err => reject(err)
            };

            this._requestQueue.enqueue(request);
        });

        if (token) {
            token.onCancellationRequested(() => {
                this._requestQueue.cancelRequest(request);
            });
        }

        return promise.then(response => {
            let endTime = Date.now();
            let elapsedTime = endTime - startTime;
            this._recordRequestDelay(command, elapsedTime);

            return response;
        });
    }

    private _doConnect(): Promise<void> {

        this._serverProcess.stderr.on('data', (data: any) => {
            this._fireEvent('stderr', String(data));
        });

        this._readLine = createInterface({
            input: this._serverProcess.stdout,
            output: this._serverProcess.stdin,
            terminal: false
        });

        const promise = new Promise<void>((resolve, reject) => {
            let listener: vscode.Disposable;

            // Convert the timeout from the seconds to milliseconds, which is required by setTimeout().
            const timeoutDuration = this._options.projectLoadTimeout * 1000;

            // timeout logic
            const handle = setTimeout(() => {
                if (listener) {
                    listener.dispose();
                }

                reject(new Error("OmniSharp server load timed out. Use the 'omnisharp.projectLoadTimeout' setting to override the default delay (one minute)."));
            }, timeoutDuration);

            // handle started-event
            listener = this.onOmnisharpStart(() => {
                if (listener) {
                    listener.dispose();
                }

                clearTimeout(handle);
                resolve();
            });
        });

        const lineReceived = this._onLineReceived.bind(this);

        this._readLine.addListener('line', lineReceived);

        this._disposables.add(Disposable.create(() => {
            this._readLine.removeListener('line', lineReceived);
        }));

        return promise;
    }

    private _onLineReceived(line: string) {
        line = line.trim();

        if (line[0] !== '{') {
            this.eventStream.post(new ObservableEvents.OmnisharpServerMessage(line));
            return;
        }

        let packet: protocol.WireProtocol.Packet;
        try {
            packet = JSON.parse(line);
        }
        catch (err) {
            // This isn't JSON
            return;
        }

        if (!packet.Type) {
            // Bogus packet
            return;
        }

        switch (packet.Type) {
            case 'response':
                this._handleResponsePacket(<protocol.WireProtocol.ResponsePacket>packet);
                break;
            case 'event':
                this._handleEventPacket(<protocol.WireProtocol.EventPacket>packet);
                break;
            default:
                this.eventStream.post(new ObservableEvents.OmnisharpServerMessage(`Unknown packet type: ${packet.Type}`));
                break;
        }
    }

    private _handleResponsePacket(packet: protocol.WireProtocol.ResponsePacket) {
        const request = this._requestQueue.dequeue(packet.Command, packet.Request_seq);

        if (!request) {
            this.eventStream.post(new ObservableEvents.OmnisharpServerMessage(`Received response for ${packet.Command} but could not find request.`));
            return;
        }

        this.eventStream.post(new ObservableEvents.OmnisharpServerVerboseMessage(`handleResponse: ${packet.Command} (${packet.Request_seq})`));

        if (packet.Success) {
            request.onSuccess(packet.Body);
        }
        else {
            request.onError(packet.Message || packet.Body);
        }

        this._requestQueue.drain();
    }

    private _handleEventPacket(packet: protocol.WireProtocol.EventPacket): void {
        if (packet.Event === 'log') {
            const entry = <{ LogLevel: string; Name: string; Message: string; }>packet.Body;
            this.eventStream.post(new ObservableEvents.OmnisharpEventPacketReceived(entry.LogLevel, entry.Name, entry.Message));
        }
        else {
            // fwd all other events
            this._fireEvent(packet.Event, packet.Body);
        }
    }

    private _makeRequest(request: Request) {
        const id = OmniSharpServer._nextId++;

        const requestPacket: protocol.WireProtocol.RequestPacket = {
            Type: 'request',
            Seq: id,
            Command: request.command,
            Arguments: request.data
        };

        this.eventStream.post(new ObservableEvents.OmnisharpRequestMessage(request, id));
        this._serverProcess.stdin.write(JSON.stringify(requestPacket) + '\n');
        return id;
    }
}

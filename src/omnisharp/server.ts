/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventEmitter } from 'events';
import { ChildProcess, exec } from 'child_process';
import { ReadLine, createInterface } from 'readline';
import { launchOmniSharp } from './launcher';
import { Options } from './options';
import { Logger } from '../logger';
import { DelayTracker } from './delayTracker';
import { LaunchTarget, findLaunchTargets } from './launcher';
import { Request, RequestQueueCollection } from './requestQueue';
import TelemetryReporter from 'vscode-extension-telemetry';
import * as os from 'os';
import * as path from 'path';
import * as protocol from './protocol';
import * as utils from '../common';
import * as vscode from 'vscode';
import { setTimeout } from 'timers';
import { OmnisharpManager } from './OmnisharpManager';
import { PlatformInformation } from '../platform';

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

export class OmniSharpServer {

    private static _nextId = 1;

    private _debugMode: boolean = false;

    private _readLine: ReadLine;
    private _disposables: vscode.Disposable[] = [];

    private _reporter: TelemetryReporter;
    private _delayTrackers: { [requestName: string]: DelayTracker };
    private _telemetryIntervalId: NodeJS.Timer = undefined;

    private _eventBus = new EventEmitter();
    private _state: ServerState = ServerState.Stopped;
    private _launchTarget: LaunchTarget;
    private _requestQueue: RequestQueueCollection;
    private _channel: vscode.OutputChannel;
    private _logger: Logger;

    private _serverProcess: ChildProcess;
    private _options: Options;

    private _csharpLogger: Logger;
    private _csharpChannel: vscode.OutputChannel;
    private _packageJSON: any;

    constructor(reporter: TelemetryReporter, csharpLogger?: Logger, csharpChannel?: vscode.OutputChannel, packageJSON?: any) {
        this._reporter = reporter;

        this._channel = vscode.window.createOutputChannel('OmniSharp Log');
        this._logger = new Logger(message => this._channel.append(message));

        const logger = this._debugMode
            ? this._logger
            : new Logger(message => { });

        this._requestQueue = new RequestQueueCollection(logger, 8, request => this._makeRequest(request));
        this._csharpLogger = csharpLogger;
        this._csharpChannel = csharpChannel;
        this._packageJSON = packageJSON;
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

    private _addListener(event: string, listener: (e: any) => any, thisArg?: any): vscode.Disposable {
        listener = thisArg ? listener.bind(thisArg) : listener;
        this._eventBus.addListener(event, listener);
        return new vscode.Disposable(() => this._eventBus.removeListener(event, listener));
    }

    protected _fireEvent(event: string, args: any): void {
        this._eventBus.emit(event, args);
    }

    // --- start, stop, and connect

    private async _start(launchTarget: LaunchTarget): Promise<void> {
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
                let serverUrl = "https://roslynomnisharp.blob.core.windows.net";
                let installPath = ".omnisharp/experimental";
                let extensionPath = utils.getExtensionPath();
                let manager = new OmnisharpManager(this._csharpChannel, this._csharpLogger, this._packageJSON, this._reporter);
                let platformInfo = await PlatformInformation.GetCurrent();
                launchPath = await manager.GetOmnisharpPath(this._options.path, this._options.useMono, serverUrl, installPath, extensionPath, platformInfo);
            }
            catch (error) {
                this._logger.appendLine('Error occured in loading omnisharp from omnisharp.path');
                this._logger.appendLine(`Could not start the server due to ${error.toString()}`);
                this._logger.appendLine();
                return;
            }
        }

        this._logger.appendLine(`Starting OmniSharp server at ${new Date().toLocaleString()}`);
        this._logger.increaseIndent();
        this._logger.appendLine(`Target: ${solutionPath}`);
        this._logger.decreaseIndent();
        this._logger.appendLine();

        this._fireEvent(Events.BeforeServerStart, solutionPath);

        return launchOmniSharp(cwd, args, launchPath).then(value => {
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
            // Start telemetry reporting
            this._telemetryIntervalId = setInterval(() => this._reportTelemetry(), TelemetryReportingDelay);
        }).then(() => {
            this._requestQueue.drain();
        }).catch(err => {
            this._fireEvent(Events.ServerError, err);
            return this.stop();
        });
    }

    public stop(): Promise<void> {

        while (this._disposables.length) {
            this._disposables.pop().dispose();
        }

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

        return cleanupPromise.then(() => {
            this._serverProcess = null;
            this._setState(ServerState.Stopped);
            this._fireEvent(Events.ServerStop, this);
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

        this._disposables.push(new vscode.Disposable(() => {
            this._readLine.removeListener('line', lineReceived);
        }));

        return promise;
    }

    private _onLineReceived(line: string) {
        line = line.trim();

        if (line[0] !== '{') {
            this._logger.appendLine(line);
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
                console.warn(`Unknown packet type: ${packet.Type}`);
                break;
        }
    }

    private _handleResponsePacket(packet: protocol.WireProtocol.ResponsePacket) {
        const request = this._requestQueue.dequeue(packet.Command, packet.Request_seq);

        if (!request) {
            this._logger.appendLine(`Received response for ${packet.Command} but could not find request.`);
            return;
        }

        if (this._debugMode) {
            this._logger.appendLine(`handleResponse: ${packet.Command} (${packet.Request_seq})`);
        }

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
            this._logOutput(entry.LogLevel, entry.Name, entry.Message);
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

        if (this._debugMode) {
            this._logger.append(`makeRequest: ${request.command} (${id})`);
            if (request.data) {
                this._logger.append(`, data=${JSON.stringify(request.data)}`);
            }
            this._logger.appendLine();
        }

        this._serverProcess.stdin.write(JSON.stringify(requestPacket) + '\n');

        return id;
    }

    private static getLogLevelPrefix(logLevel: string) {
        switch (logLevel) {
            case "TRACE": return "trce";
            case "DEBUG": return "dbug";
            case "INFORMATION": return "info";
            case "WARNING": return "warn";
            case "ERROR": return "fail";
            case "CRITICAL": return "crit";
            default: throw new Error(`Unknown log level value: ${logLevel}`);
        }
    }

    private _isFilterableOutput(logLevel: string, name: string, message: string) {
        // filter messages like: /codecheck: 200 339ms
        const timing200Pattern = /^\/[\/\w]+: 200 \d+ms/;

        return logLevel === "INFORMATION"
            && name === "OmniSharp.Middleware.LoggingMiddleware"
            && timing200Pattern.test(message);
    }

    private _logOutput(logLevel: string, name: string, message: string) {
        if (this._debugMode || !this._isFilterableOutput(logLevel, name, message)) {
            let output = `[${OmniSharpServer.getLogLevelPrefix(logLevel)}]: ${name}${os.EOL}${message}`;

            const newLinePlusPadding = os.EOL + "        ";
            output = output.replace(os.EOL, newLinePlusPadding);

            this._logger.appendLine(output);
        }
    }
}

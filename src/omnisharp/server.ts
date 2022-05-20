
/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as protocol from './protocol';
import * as utils from '../common';
import * as serverUtils from '../omnisharp/utils';
import { vscode, CancellationToken } from '../vscodeAdapter';
import { ChildProcess, exec } from 'child_process';
import { LaunchTarget, findLaunchTargets, LaunchTargetKind } from './launcher';
import { createInterface } from 'readline';
import { Request, RequestQueueCollection } from './requestQueue';
import { DelayTracker } from './delayTracker';
import { EventEmitter } from 'events';
import { OmnisharpManager, LaunchInfo } from './OmnisharpManager';
import { Options } from './options';
import { PlatformInformation } from '../platform';
import { launchOmniSharp } from './launcher';
import { setTimeout } from 'timers';
import { OmnisharpDownloader } from './OmnisharpDownloader';
import * as ObservableEvents from './loggingEvents';
import { EventStream } from '../EventStream';
import { NetworkSettingsProvider } from '../NetworkSettings';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import CompositeDisposable from '../CompositeDisposable';
import Disposable from '../Disposable';
import OptionProvider from '../observers/OptionProvider';
import { IHostExecutableResolver } from '../constants/IHostExecutableResolver';
import { showProjectSelector } from '../features/commands';
import { removeBOMFromBuffer, removeBOMFromString } from '../utils/removeBOM';

enum ServerState {
    Starting,
    Started,
    Stopped
}

type State = {
    status: ServerState.Stopped,
} | {
    status: ServerState.Starting,
    disposables: CompositeDisposable,
} | {
    status: ServerState.Started,
    disposables: CompositeDisposable,
    serverProcess: ChildProcess,
    telemetryIntervalId: NodeJS.Timeout,
};

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

    export const ProjectDiagnosticStatus = 'ProjectDiagnosticStatus';

    export const MsBuildProjectDiagnostics = 'MsBuildProjectDiagnostics';

    export const TestMessage = 'TestMessage';

    export const BeforeServerInstall = 'BeforeServerInstall';
    export const BeforeServerStart = 'BeforeServerStart';
    export const ServerStart = 'ServerStart';
    export const ServerStop = 'ServerStop';

    export const MultipleLaunchTargets = 'server:MultipleLaunchTargets';

    export const Started = 'started';

    export const ProjectConfiguration = 'ProjectConfiguration';
}

const TelemetryReportingDelay = 2 * 60 * 1000; // two minutes
const serverUrl = "https://roslynomnisharp.blob.core.windows.net";
const installPath = ".omnisharp";
const latestVersionFileServerPath = 'releases/versioninfo.txt';

export class OmniSharpServer {

    private static _nextId = 1;

    private _delayTrackers: { [requestName: string]: DelayTracker } = {};

    private _eventBus = new EventEmitter();
    private _state: State = { status: ServerState.Stopped };
    private _launchTarget: LaunchTarget | undefined;
    private _requestQueue: RequestQueueCollection;
    private _sessionProperties: { [key: string]: any } = {};

    private _omnisharpManager: OmnisharpManager;
    private updateProjectDebouncer = new Subject<ObservableEvents.ProjectModified>();
    private firstUpdateProject: boolean;

    constructor(
        private vscode: vscode,
        networkSettingsProvider: NetworkSettingsProvider,
        private packageJSON: any,
        private platformInfo: PlatformInformation,
        private eventStream: EventStream,
        private optionProvider: OptionProvider,
        private extensionPath: string,
        private monoResolver: IHostExecutableResolver,
        private dotnetResolver: IHostExecutableResolver,
        public decompilationAuthorized: boolean) {
        this._requestQueue = new RequestQueueCollection(this.eventStream, 8, request => this._makeRequest(request));
        let downloader = new OmnisharpDownloader(networkSettingsProvider, this.eventStream, this.packageJSON, platformInfo, extensionPath);
        this._omnisharpManager = new OmnisharpManager(downloader, platformInfo);
        this.updateProjectDebouncer.pipe(debounceTime(1500)).subscribe((event) => { this.updateProjectInfo(); });
        this.firstUpdateProject = true;
    }

    public get sessionProperties() {
        return this._sessionProperties;
    }

    public isRunning(): boolean {
        return this._state.status === ServerState.Started;
    }

    public async waitForEmptyEventQueue(): Promise<void> {
        while (!this._requestQueue.isEmpty()) {
            let p = new Promise((resolve) => setTimeout(resolve, 100));
            await p;
        }
    }

    private _setState(state: State): void {
        if (state.status !== this._state.status) {
            this._state = state;
            this._fireEvent(Events.StateChanged, this._state.status);
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

    public getSolutionPathOrFolder(): string | undefined {
        return this._launchTarget?.target;
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

    public onProjectDiagnosticStatus(listener: (e: protocol.ProjectDiagnosticStatus) => any, thisArg?: any) {
        return this._addListener(Events.ProjectDiagnosticStatus, listener, thisArg);
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
        return new Disposable(() => this._eventBus.removeListener(event, listener));
    }

    protected _fireEvent(event: string, args: any): void {
        this._eventBus.emit(event, args);
    }

    // --- start, stop, and connect

    private async _start(launchTarget: LaunchTarget): Promise<void> {
        if (this._state.status !== ServerState.Stopped) {
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnServerError("Attempt to start OmniSharp server failed because another server instance is running."));
            return;
        }

        if (launchTarget.workspaceKind === LaunchTargetKind.LiveShare) {
            this.eventStream.post(new ObservableEvents.OmnisharpServerMessage("During Live Share sessions language services are provided by the Live Share server."));
            return;
        }

        const disposables = new CompositeDisposable();

        disposables.add(this.onServerError(err =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnServerError(err))
        ));

        disposables.add(this.onError((message: protocol.ErrorMessage) =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnError(message))
        ));

        disposables.add(this.onMsBuildProjectDiagnostics((message: protocol.MSBuildProjectDiagnostics) =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerMsBuildProjectDiagnostics(message))
        ));

        disposables.add(this.onUnresolvedDependencies((message: protocol.UnresolvedDependenciesMessage) =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerUnresolvedDependencies(message))
        ));

        disposables.add(this.onStderr((message: string) =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnStdErr(message))
        ));

        disposables.add(this.onMultipleLaunchTargets((targets: LaunchTarget[]) =>
            this.eventStream.post(new ObservableEvents.OmnisharpOnMultipleLaunchTargets(targets))
        ));

        disposables.add(this.onBeforeServerInstall(() =>
            this.eventStream.post(new ObservableEvents.OmnisharpOnBeforeServerInstall())
        ));

        disposables.add(this.onBeforeServerStart(() => {
            this.eventStream.post(new ObservableEvents.OmnisharpOnBeforeServerStart());
        }));

        disposables.add(this.onServerStop(() =>
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnStop())
        ));

        disposables.add(this.onServerStart(() => {
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnStart());
        }));

        disposables.add(this.onProjectDiagnosticStatus((message: protocol.ProjectDiagnosticStatus) =>
            this.eventStream.post(new ObservableEvents.OmnisharpProjectDiagnosticStatus(message))
        ));

        disposables.add(this.onProjectConfigurationReceived((message: protocol.ProjectConfigurationMessage) => {
            this.eventStream.post(new ObservableEvents.ProjectConfiguration(message));
        }));

        disposables.add(this.onProjectAdded(this.debounceUpdateProjectWithLeadingTrue));
        disposables.add(this.onProjectChange(this.debounceUpdateProjectWithLeadingTrue));
        disposables.add(this.onProjectRemoved(this.debounceUpdateProjectWithLeadingTrue));

        this._setState({
            status: ServerState.Starting,
            disposables,
        });
        this._launchTarget = launchTarget;

        const solutionPath = launchTarget.target;
        const cwd = path.dirname(solutionPath);

        const options = this.optionProvider.GetLatestOptions();

        const args = [
            '-z',
            '-s', solutionPath,
            '--hostPID', process.pid.toString(),
            'DotNet:enablePackageRestore=false',
            '--encoding', 'utf-8',
            '--loglevel', options.loggingLevel
        ];

        if (!options.razorDisabled) {
            // Razor support only exists for certain platforms, so only load the plugin if present
            const razorPluginPath = options.razorPluginPath.length > 0 ? options.razorPluginPath : path.join(
                this.extensionPath,
                '.razor',
                'OmniSharpPlugin',
                'Microsoft.AspNetCore.Razor.OmniSharpPlugin.dll');
            if (fs.existsSync(razorPluginPath)) {
                args.push('--plugin', razorPluginPath);
            }
        }

        if (options.waitForDebugger === true) {
            args.push('--debug');
        }

        for (let i = 0; i < options.excludePaths.length; i++) {
            args.push(`FileOptions:SystemExcludeSearchPatterns:${i}=${options.excludePaths[i]}`);
        }

        if (options.enableMsBuildLoadProjectsOnDemand === true) {
            args.push('MsBuild:LoadProjectsOnDemand=true');
        }

        if (options.enableRoslynAnalyzers === true) {
            args.push('RoslynExtensionsOptions:EnableAnalyzersSupport=true');
        }

        if (options.enableEditorConfigSupport === true) {
            args.push('FormattingOptions:EnableEditorConfigSupport=true');
        }

        if (options.organizeImportsOnFormat === true) {
            args.push('FormattingOptions:OrganizeImports=true');
        }

        if (this.decompilationAuthorized && options.enableDecompilationSupport === true) {
            args.push('RoslynExtensionsOptions:EnableDecompilationSupport=true');
        }

        if (options.enableImportCompletion === true) {
            args.push('RoslynExtensionsOptions:EnableImportCompletion=true');
        }

        if (options.enableAsyncCompletion === true) {
            args.push('RoslynExtensionsOptions:EnableAsyncCompletion=true');
        }

        if (options.sdkPath.length > 0) {
            args.push(`Sdk:Path='${options.sdkPath}'`);
        }

        if (options.sdkVersion.length > 0) {
            args.push(`Sdk:Version='${options.sdkVersion}'`);
        }

        if (options.sdkIncludePrereleases) {
            args.push(`Sdk:IncludePrereleases=true`);
        }

        if (options.inlayHintsEnableForParameters === true) {
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:EnableForParameters=${options.inlayHintsEnableForParameters.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForLiteralParameters=${options.inlayHintsForLiteralParameters.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForIndexerParameters=${options.inlayHintsForIndexerParameters.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForObjectCreationParameters=${options.inlayHintsForObjectCreationParameters.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForOtherParameters=${options.inlayHintsForOtherParameters.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:SuppressForParametersThatDifferOnlyBySuffix=${options.inlayHintsSuppressForParametersThatDifferOnlyBySuffix.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:SuppressForParametersThatMatchMethodIntent=${options.inlayHintsSuppressForParametersThatMatchMethodIntent.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:SuppressForParametersThatMatchArgumentName=${options.inlayHintsSuppressForParametersThatMatchArgumentName.toString()}`);
        }

        if (options.inlayHintsEnableForTypes === true) {
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:EnableForTypes=${options.inlayHintsEnableForTypes.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForImplicitVariableTypes=${options.inlayHintsForImplicitVariableTypes.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForLambdaParameterTypes=${options.inlayHintsForLambdaParameterTypes.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForImplicitObjectCreation=${options.inlayHintsForImplicitObjectCreation.toString()}`);
        }

        if (options.analyzeOpenDocumentsOnly === true) {
            args.push('RoslynExtensionsOptions:AnalyzeOpenDocumentsOnly=true');
        }

        let launchInfo: LaunchInfo;
        try {
            launchInfo = await this._omnisharpManager.GetOmniSharpLaunchInfo(this.packageJSON.defaults.omniSharp, options.path, /* useFramework */ !options.useModernNet, serverUrl, latestVersionFileServerPath, installPath, this.extensionPath);
        }
        catch (e) {
            const error = e as Error; // Unsafe TypeScript hack to recognize the catch type as Error.
            this.eventStream.post(new ObservableEvents.OmnisharpFailure(`Error occurred in loading omnisharp from omnisharp.path\nCould not start the server due to ${error.toString()}`, error));
            return;
        }

        this.eventStream.post(new ObservableEvents.OmnisharpInitialisation(new Date(), solutionPath));
        this._fireEvent(Events.BeforeServerStart, solutionPath);

        try {
            const launchResult = await launchOmniSharp(cwd, args, launchInfo, this.platformInfo, options, this.monoResolver, this.dotnetResolver);
            this.eventStream.post(new ObservableEvents.OmnisharpLaunch(launchResult.hostVersion, launchResult.hostPath, launchResult.hostIsMono, launchResult.command, launchResult.process.pid));

            if (!options.razorDisabled && options.razorPluginPath.length > 0) {
                if (fs.existsSync(options.razorPluginPath)) {
                    this.eventStream.post(new ObservableEvents.RazorPluginPathSpecified(options.razorPluginPath));
                } else {
                    this.eventStream.post(new ObservableEvents.RazorPluginPathDoesNotExist(options.razorPluginPath));
                }
            }

            this._delayTrackers = {};

            await this._doConnect(disposables, launchResult.process, options);
            this._setState({
                status: ServerState.Started,
                disposables,
                serverProcess: launchResult.process,
                telemetryIntervalId: setInterval(() => this._reportTelemetry(), TelemetryReportingDelay),
            });
            this._fireEvent(Events.ServerStart, solutionPath);

            this._requestQueue.drain();
        }
        catch (err) {
            this._fireEvent(Events.ServerError, err);
            return this.stop();
        }
    }

    private onProjectConfigurationReceived(listener: (e: protocol.ProjectConfigurationMessage) => void) {
        return this._addListener(Events.ProjectConfiguration, listener);
    }

    private debounceUpdateProjectWithLeadingTrue = () => {
        // Call the updateProjectInfo directly if it is the first time, otherwise debounce the request
        // This needs to be done so that we have a project information for the first incoming request

        if (this.firstUpdateProject) {
            this.updateProjectInfo();
        }
        else {
            this.updateProjectDebouncer.next(new ObservableEvents.ProjectModified());
        }
    }

    private updateProjectInfo = async () => {
        this.firstUpdateProject = false;
        let info = await serverUtils.requestWorkspaceInformation(this);
        //once we get the info, push the event into the event stream
        this.eventStream.post(new ObservableEvents.WorkspaceInformationUpdated(info));
    }

    public async stop(): Promise<void> {
        // We're already stopped, nothing to do :).
        if (this._state.status === ServerState.Stopped) {
            return;
        }

        // Clear the session properties when the session ends.
        this._sessionProperties = {};

        if (this._state.status === ServerState.Started) {
            const { serverProcess, telemetryIntervalId } = this._state;

            clearInterval(telemetryIntervalId);
            this._reportTelemetry();

            if (process.platform === 'win32') {
                // when killing a process in windows its child
                // processes are *not* killed but become root
                // processes. Therefore we use TASKKILL.EXE
                await new Promise<void>((resolve, reject) => {
                    const killer = exec(`taskkill /F /T /PID ${serverProcess.pid}`, (err, stdout, stderr) => {
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
                const children = await utils.getUnixChildProcessIds(serverProcess.pid);
                for (const child of children) {
                    process.kill(child, 'SIGTERM');
                }

                serverProcess.kill('SIGTERM');
            }
        }

        const { disposables } = this._state;

        this._setState({ status: ServerState.Stopped });
        this._fireEvent(Events.ServerStop, this);

        // Dispose of the disposables only _after_ we've fired the last server event.
        disposables.dispose();
    }

    public async restart(launchTarget: LaunchTarget | undefined = this._launchTarget): Promise<void> {
        if (this._state.status === ServerState.Starting) {
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnServerError("Attempt to restart OmniSharp server failed because another server instance is starting."));
            return;
        }

        if (launchTarget !== undefined) {
            await this.stop();
            this.eventStream.post(new ObservableEvents.OmnisharpRestart());
            await this._start(launchTarget);
        }
    }

    public async autoStart(preferredPath: string): Promise<void> {
        const options = this.optionProvider.GetLatestOptions();
        const launchTargets = await findLaunchTargets(options);

        // If there aren't any potential launch targets, we create file watcher and try to
        // start the server again once a *.sln, *.slnf, *.csproj, project.json, CSX or Cake file is created.
        if (launchTargets.length === 0) {
            await new Promise<void>((resolve, reject) => {
                // 1st watch for files
                const watcher = this.vscode.workspace.createFileSystemWatcher('{**/*.sln,**/*.slnf,**/*.csproj,**/project.json,**/*.csx,**/*.cake}',
                    /*ignoreCreateEvents*/ false,
                    /*ignoreChangeEvents*/ true,
                    /*ignoreDeleteEvents*/ true);

                watcher.onDidCreate(uri => {
                    watcher.dispose();
                    resolve();
                });
            });

            // 2nd try again
            return this.autoStart(preferredPath);
        }
        else if (launchTargets.length === 1) {
            // If there's only one target, just start
            return this._start(launchTargets[0]);
        }

        // First, try to launch against something that matches the user's preferred target
        const defaultLaunchSolutionConfigValue = this.optionProvider.GetLatestOptions().defaultLaunchSolution;
        const defaultLaunchSolutionTarget = launchTargets.find((a) => (path.basename(a.target) === defaultLaunchSolutionConfigValue));
        if (defaultLaunchSolutionTarget) {
            return this._start(defaultLaunchSolutionTarget);
        }

        // If there's more than one launch target, we start the server if one of the targets
        // matches the preferred path.
        if (preferredPath.length > 0) {
            const preferredLaunchTarget = launchTargets.find((a_1) => a_1.target === preferredPath);
            if (preferredLaunchTarget) {
                return this._start(preferredLaunchTarget);
            }
        }

        // To maintain previous behavior when there are mulitple targets available,
        // launch with first Solution or Folder target.
        const firstFolderOrSolutionTarget = launchTargets
            .find(target => target.workspaceKind == LaunchTargetKind.Folder || target.workspaceKind == LaunchTargetKind.Solution);
        if (firstFolderOrSolutionTarget) {
            return this._start(firstFolderOrSolutionTarget);
        }

        // When running integration tests, open the first launch target.
        if (process.env.RUNNING_INTEGRATION_TESTS === "true") {
            return this._start(launchTargets[0]);
        }

        // Otherwise, we fire the "MultipleLaunchTargets" event,
        // which is handled in status.ts to display the launch target selector.
        this._fireEvent(Events.MultipleLaunchTargets, launchTargets);
        return showProjectSelector(this, launchTargets);
    }

    // --- requests et al

    public async makeRequest<TResponse>(command: string, data?: any, token?: CancellationToken): Promise<TResponse> {
        if (!this.isRunning()) {
            return Promise.reject<TResponse>('OmniSharp server is not running.');
        }

        let startTime: number;
        let request: Request;

        const promise = new Promise<TResponse>((resolve, reject) => {
            startTime = Date.now();

            request = {
                command,
                data,
                onSuccess: value => resolve(value),
                onError: err => reject(err)
            };

            this._requestQueue.enqueue(request);
        });

        if (token !== undefined) {
            token.onCancellationRequested(() => {
                this.eventStream.post(new ObservableEvents.OmnisharpServerRequestCancelled(request.command, request.id));
                this._requestQueue.cancelRequest(request);
                // Note: This calls reject() on the promise returned by OmniSharpServer.makeRequest
                request.onError(new Error(`Request ${request.command} cancelled, id: ${request.id}`));
            });
        }

        return promise.then(response => {
            let endTime = Date.now();
            let elapsedTime = endTime - startTime;
            this._recordRequestDelay(command, elapsedTime);

            return response;
        });
    }

    private async _doConnect(
        disposables: CompositeDisposable,
        serverProcess: ChildProcess,
        options: Options): Promise<void> {
        serverProcess.stderr.on('data', (data: Buffer) => {
            let trimData = removeBOMFromBuffer(data);
            if (trimData.length > 0) {
                this._fireEvent(Events.StdErr, trimData.toString());
            }
        });

        const readLine = createInterface({
            input: serverProcess.stdout,
            output: serverProcess.stdin,
            terminal: false
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

        readLine.addListener('line', lineReceived);

        disposables.add(new Disposable(() => {
            readLine.removeListener('line', lineReceived);
        }));

        return promise;
    }

    private _onLineReceived(line: string) {
        line = removeBOMFromString(line);

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

    private _makeRequest(request: Request): number {
        if (this._state.status !== ServerState.Started) {
            throw new Error("Tried to make a request when the OmniSharp server wasn't running");
        }

        const id = OmniSharpServer._nextId++;
        request.id = id;

        const requestPacket: protocol.WireProtocol.RequestPacket = {
            Type: 'request',
            Seq: id,
            Command: request.command,
            Arguments: request.data
        };

        this.eventStream.post(new ObservableEvents.OmnisharpRequestMessage(request, id));
        this._state.serverProcess.stdin.write(JSON.stringify(requestPacket) + '\n');
        return id;
    }
}

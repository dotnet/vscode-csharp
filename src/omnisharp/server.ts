/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as protocol from './protocol';
import * as serverUtils from '../omnisharp/utils';
import { vscode, CancellationToken } from '../vscodeAdapter';
import { LaunchTarget, LaunchTargetKind } from "../shared/launchTarget";
import { DelayTracker } from './delayTracker';
import { EventEmitter } from 'events';
import { OmnisharpManager } from './omnisharpManager';
import { PlatformInformation } from '../shared/platform';
import { OmnisharpDownloader } from './omnisharpDownloader';
import * as ObservableEvents from './loggingEvents';
import { EventStream } from '../eventStream';
import { NetworkSettingsProvider } from '../networkSettings';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import CompositeDisposable from '../compositeDisposable';
import Disposable from '../disposable';
import OptionProvider from '../shared/observers/optionProvider';
import { ExtensionContext, OutputChannel } from 'vscode';
import { LanguageMiddlewareFeature } from './languageMiddlewareFeature';
import { LspEngine } from './engines/lspEngine';
import { IEngine } from './engines/IEngine';
import { StdioEngine } from './engines/stdioEngine';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';
import { showProjectSelector } from '../features/commands';
import { validateRequirements } from './requirementCheck';
import { Advisor } from '../features/diagnosticsProvider';
import TestManager from '../features/dotnetTest';
import { findLaunchTargets } from './launcher';

enum ServerState {
    Starting,
    Started,
    Stopped,
}

type State = {
    status: ServerState.Stopped,
} | {
    status: ServerState.Starting,
    disposables: CompositeDisposable,
} | {
    status: ServerState.Started,
    disposables: CompositeDisposable,
    engine: IEngine,
    telemetryIntervalId: NodeJS.Timeout,
};

export namespace Events {
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

    export const BackgroundDiagnosticStatus = 'BackgroundDiagnosticStatus';

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

export class OmniSharpServer {

    private _delayTrackers: { [requestName: string]: DelayTracker } = {};

    private _eventBus = new EventEmitter();
    private _state: State = { status: ServerState.Stopped };
    private _launchTarget: LaunchTarget | undefined;

    private _sessionProperties: { [key: string]: any } = {};

    private _omnisharpManager: OmnisharpManager;
    private updateProjectDebouncer = new Subject<
        ObservableEvents.ProjectModified
    >();
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
        public decompilationAuthorized: boolean,
        private context: ExtensionContext,
        private outputChannel: OutputChannel,
        private languageMiddlewareFeature: LanguageMiddlewareFeature
    ) {
        const downloader = new OmnisharpDownloader(
            networkSettingsProvider,
            this.eventStream,
            this.packageJSON,
            platformInfo,
            extensionPath);
        this._omnisharpManager = new OmnisharpManager(downloader, platformInfo);
        this.updateProjectDebouncer
            .pipe(debounceTime(1500))
            .subscribe((_) => {
                this.updateProjectInfo();
            });
        this.firstUpdateProject = true;
    }

    public get sessionProperties() {
        return this._sessionProperties;
    }

    public isRunning(): boolean {
        return this._state.status === ServerState.Started;
    }

    public async waitForInitialize(): Promise<void> {
        if (this._state.status !== ServerState.Started) {
            throw new Error('OmniSharp server is not running.');
        }

        const { engine } = this._state;
        await engine.waitForInitialize();
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

    public onBackgroundDiagnosticStatus(listener: (e: protocol.BackgroundDiagnosticStatusMessage) => any, thisArg?: any) {
        return this._addListener(Events.BackgroundDiagnosticStatus, listener, thisArg);
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

    public async start(launchTarget: LaunchTarget): Promise<void> {
        if (this._state.status !== ServerState.Stopped) {
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnServerError("Attempt to start OmniSharp server failed because another server instance is running."));
            return;
        }

        if (launchTarget.workspaceKind === LaunchTargetKind.LiveShare) {
            this.eventStream.post(new ObservableEvents.OmnisharpServerMessage("During Live Share sessions language services are provided by the Live Share server."));
            return;
        }

        const options = this.optionProvider.GetLatestOptions();

        if (!await validateRequirements(options)) {
            this.eventStream.post(new ObservableEvents.OmnisharpServerMessage("OmniSharp failed to start because of missing requirements."));
            return;
        }

        const disposables = new CompositeDisposable();

        let engine: IEngine | undefined;
        const omnisharpOptions = options.omnisharpOptions;
        if (omnisharpOptions.enableLspDriver) {
            engine = new LspEngine(
                this._eventBus,
                this.eventStream,
                this.context,
                this.outputChannel,
                disposables,
                this.languageMiddlewareFeature,
                this.platformInfo,
                this.monoResolver,
                this.dotnetResolver
            );
        } else {
            engine = new StdioEngine(
                this._eventBus,
                this.eventStream,
                this.platformInfo,
                this.monoResolver,
                this.dotnetResolver,
                disposables
            );
        }

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

        disposables.add(this.onBackgroundDiagnosticStatus((message: protocol.BackgroundDiagnosticStatusMessage) =>
            this.eventStream.post(new ObservableEvents.OmnisharpBackgroundDiagnosticStatus(message))
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

        const args = [
            '-z',
            '-s',
            solutionPath,
            '--hostPID',
            process.pid.toString(),
            'DotNet:enablePackageRestore=false',
            '--loglevel',
            omnisharpOptions.loggingLevel,
        ];

        const razorOptions = options.razorOptions;
        // Razor support only exists for certain platforms, so only load the plugin if present
        const razorPluginPath = razorOptions.razorPluginPath.length > 0 ? razorOptions.razorPluginPath : path.join(
            this.extensionPath,
            '.razor',
            'OmniSharpPlugin',
            'Microsoft.AspNetCore.Razor.OmniSharpPlugin.dll');
        if (fs.existsSync(razorPluginPath)) {
            args.push('--plugin', razorPluginPath);
        }

        if (options.commonOptions.waitForDebugger === true) {
            args.push('--debug');
        }

        for (let i = 0; i < options.commonOptions.excludePaths.length; i++) {
            args.push(`FileOptions:SystemExcludeSearchPatterns:${i}=${options.commonOptions.excludePaths[i]}`);
        }

        if (omnisharpOptions.enableMsBuildLoadProjectsOnDemand === true) {
            args.push('MsBuild:LoadProjectsOnDemand=true');
        }

        if (omnisharpOptions.enableRoslynAnalyzers === true) {
            args.push('RoslynExtensionsOptions:EnableAnalyzersSupport=true');
        }

        if (omnisharpOptions.enableEditorConfigSupport === true) {
            args.push('FormattingOptions:EnableEditorConfigSupport=true');
        }

        if (omnisharpOptions.organizeImportsOnFormat === true) {
            args.push('FormattingOptions:OrganizeImports=true');
        }

        if (this.decompilationAuthorized && omnisharpOptions.enableDecompilationSupport === true) {
            args.push('RoslynExtensionsOptions:EnableDecompilationSupport=true');
        }

        if (omnisharpOptions.enableImportCompletion === true) {
            args.push('RoslynExtensionsOptions:EnableImportCompletion=true');
        }

        if (omnisharpOptions.enableAsyncCompletion === true) {
            args.push('RoslynExtensionsOptions:EnableAsyncCompletion=true');
        }

        if (omnisharpOptions.sdkPath.length > 0) {
            args.push(`Sdk:Path=${omnisharpOptions.sdkPath}`);
        }

        if (omnisharpOptions.sdkVersion.length > 0) {
            args.push(`Sdk:Version=${omnisharpOptions.sdkVersion}`);
        }

        if (omnisharpOptions.sdkIncludePrereleases) {
            args.push(`Sdk:IncludePrereleases=true`);
        }

        if (omnisharpOptions.inlayHintsEnableForParameters === true) {
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:EnableForParameters=${omnisharpOptions.inlayHintsEnableForParameters.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForLiteralParameters=${omnisharpOptions.inlayHintsForLiteralParameters.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForIndexerParameters=${omnisharpOptions.inlayHintsForIndexerParameters.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForObjectCreationParameters=${omnisharpOptions.inlayHintsForObjectCreationParameters.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForOtherParameters=${omnisharpOptions.inlayHintsForOtherParameters.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:SuppressForParametersThatDifferOnlyBySuffix=${omnisharpOptions.inlayHintsSuppressForParametersThatDifferOnlyBySuffix.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:SuppressForParametersThatMatchMethodIntent=${omnisharpOptions.inlayHintsSuppressForParametersThatMatchMethodIntent.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:SuppressForParametersThatMatchArgumentName=${omnisharpOptions.inlayHintsSuppressForParametersThatMatchArgumentName.toString()}`);
        }

        if (omnisharpOptions.inlayHintsEnableForTypes === true) {
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:EnableForTypes=${omnisharpOptions.inlayHintsEnableForTypes.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForImplicitVariableTypes=${omnisharpOptions.inlayHintsForImplicitVariableTypes.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForLambdaParameterTypes=${omnisharpOptions.inlayHintsForLambdaParameterTypes.toString()}`);
            args.push(`RoslynExtensionsOptions:InlayHintsOptions:ForImplicitObjectCreation=${omnisharpOptions.inlayHintsForImplicitObjectCreation.toString()}`);
        }

        if (omnisharpOptions.analyzeOpenDocumentsOnly === true) {
            args.push('RoslynExtensionsOptions:AnalyzeOpenDocumentsOnly=true');
        }

        for (let i = 0; i < omnisharpOptions.dotNetCliPaths.length; i++) {
            args.push(`DotNetCliOptions:LocationPaths:${i}=${omnisharpOptions.dotNetCliPaths[i]}`);
        }

        let launchPath: string;
        try {
            launchPath = await this._omnisharpManager.GetOmniSharpLaunchPath(this.packageJSON.defaults.omniSharp, options.commonOptions.serverPath, /* useFramework */ !omnisharpOptions.useModernNet, this.extensionPath);
        }
        catch (e) {
            const error = e as Error; // Unsafe TypeScript hack to recognize the catch type as Error.
            this.eventStream.post(
                new ObservableEvents.OmnisharpFailure(
                    `Error occurred in loading omnisharp from omnisharp.path\nCould not start the server due to ${error.toString()}`,
                    error));
            return;
        }

        this.eventStream.post(
            new ObservableEvents.OmnisharpInitialisation(
                omnisharpOptions.dotNetCliPaths,
                new Date(),
                solutionPath));
        this._fireEvent(Events.BeforeServerStart, solutionPath);

        try {
            await engine.start(
                cwd,
                args,
                launchTarget,
                launchPath,
                options
            );

            this._setState({
                status: ServerState.Started,
                disposables,
                engine,
                telemetryIntervalId: setInterval(() => this._reportTelemetry(), TelemetryReportingDelay),
            });

            this._delayTrackers = {};

            if (razorPluginPath !== undefined && razorOptions.razorPluginPath) {
                if (fs.existsSync(razorPluginPath)) {
                    this.eventStream.post(
                        new ObservableEvents.RazorPluginPathSpecified(
                            razorPluginPath
                        )
                    );
                } else {
                    this.eventStream.post(
                        new ObservableEvents.RazorPluginPathDoesNotExist(
                            razorPluginPath
                        )
                    );
                }
            }

            this._fireEvent(Events.ServerStart, solutionPath);
        }
        catch (err) {
            this._fireEvent(Events.ServerError, err);
            return this.stop();
        }
    }

    public async registerProviders(eventStream: EventStream, advisor: Advisor, testManager: TestManager) {
        if (this._state.status !== ServerState.Started) {
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnServerError("Attempt to register providers failed because no server instance is running."));
            return;
        }

        const { engine } = this._state;
        return await engine.registerProviders(this, this.optionProvider, this.languageMiddlewareFeature, eventStream, advisor, testManager);
    }

    private onProjectConfigurationReceived(
        listener: (e: protocol.ProjectConfigurationMessage) => void
    ) {
        return this._addListener(Events.ProjectConfiguration, listener);
    }

    private debounceUpdateProjectWithLeadingTrue = () => {
        // Call the updateProjectInfo directly if it is the first time, otherwise debounce the request
        // This needs to be done so that we have a project information for the first incoming request

        if (this.firstUpdateProject) {
            this.updateProjectInfo();
        } else {
            this.updateProjectDebouncer.next(new ObservableEvents.ProjectModified());
        }
    };

    private updateProjectInfo = async () => {
        this.firstUpdateProject = false;
        const info = await serverUtils.requestWorkspaceInformation(this);
        //once we get the info, push the event into the event stream
        this.eventStream.post(new ObservableEvents.WorkspaceInformationUpdated(info));
    };

    public async stop(): Promise<void> {
        // We're already stopped, nothing to do :).
        if (this._state.status === ServerState.Stopped) {
            return;
        }

        if (this._state.status === ServerState.Started) {
            const { disposables, engine, telemetryIntervalId } = this._state;

            await engine.stop();
            engine.dispose();

            // Clear the session properties when the session ends.
            this._sessionProperties = {};
            this._setState({ status: ServerState.Stopped });
            this._fireEvent(Events.ServerStop, this);

            // Dispose of the disposables only _after_ we've fired the last server event.
            disposables.dispose();

            // Clear and report telemetry
            clearInterval(telemetryIntervalId);
            this._reportTelemetry();
        }
    }

    public async restart(launchTarget: LaunchTarget | undefined = this._launchTarget): Promise<void> {
        if (this._state.status === ServerState.Starting) {
            this.eventStream.post(new ObservableEvents.OmnisharpServerOnServerError("Attempt to restart OmniSharp server failed because another server instance is starting."));
            return;
        }

        if (launchTarget !== undefined) {
            await this.stop();
            this.eventStream.post(new ObservableEvents.OmnisharpRestart());
            await this.start(launchTarget);
        }
    }

    public async autoStart(preferredPath: string): Promise<void> {
        const options = this.optionProvider.GetLatestOptions();
        const launchTargets = await findLaunchTargets(options);

        // If there aren't any potential launch targets, we create file watcher and try to
        // start the server again once a *.sln, *.slnf, *.csproj, project.json, CSX or Cake file is created.
        if (launchTargets.length === 0) {
            await new Promise<void>((resolve) => {
                // 1st watch for files
                const watcher = this.vscode.workspace.createFileSystemWatcher('{**/*.sln,**/*.slnf,**/*.csproj,**/project.json,**/*.csx,**/*.cake}',
                    /*ignoreCreateEvents*/ false,
                    /*ignoreChangeEvents*/ true,
                    /*ignoreDeleteEvents*/ true);

                watcher.onDidCreate(_ => {
                    watcher.dispose();
                    resolve();
                });
            });

            // 2nd try again
            return this.autoStart(preferredPath);
        }
        else if (launchTargets.length === 1) {
            // If there's only one target, just start
            return this.start(launchTargets[0]);
        }

        // First, try to launch against something that matches the user's preferred target
        const defaultLaunchSolutionConfigValue = this.optionProvider.GetLatestOptions().commonOptions.defaultSolution;
        const defaultLaunchSolutionTarget = launchTargets.find((a) => (path.basename(a.target) === defaultLaunchSolutionConfigValue));
        if (defaultLaunchSolutionTarget) {
            return this.start(defaultLaunchSolutionTarget);
        }

        // If there's more than one launch target, we start the server if one of the targets
        // matches the preferred path.
        if (preferredPath.length > 0) {
            const preferredLaunchTarget = launchTargets.find((a_1) => a_1.target === preferredPath);
            if (preferredLaunchTarget) {
                return this.start(preferredLaunchTarget);
            }
        }

        // To maintain previous behavior when there are mulitple targets available,
        // launch with first Solution or Folder target.
        const firstFolderOrSolutionTarget = launchTargets
            .find(target => target.workspaceKind == LaunchTargetKind.Folder || target.workspaceKind == LaunchTargetKind.Solution);
        if (firstFolderOrSolutionTarget) {
            return this.start(firstFolderOrSolutionTarget);
        }

        // When running integration tests, open the first launch target.
        if (process.env.RUNNING_INTEGRATION_TESTS === "true") {
            return this.start(launchTargets[0]);
        }

        // Otherwise, we fire the "MultipleLaunchTargets" event,
        // which is handled in status.ts to display the launch target selector.
        this._fireEvent(Events.MultipleLaunchTargets, launchTargets);
        return showProjectSelector(this, launchTargets);
    }

    // --- requests et al

    public async makeRequest<TResponse>(command: string, data?: any, token?: CancellationToken): Promise<TResponse> {
        if (this._state.status !== ServerState.Started) {
            return Promise.reject<TResponse>(
                'OmniSharp server is not running.'
            );
        }

        const { engine } = this._state;

        const startTime = Date.now();
        const response = await engine.makeRequest<TResponse>(command, data, token);

        const endTime = Date.now();
        const elapsedTime = endTime - startTime;
        this._recordRequestDelay(command, elapsedTime);

        return response;
    }

    public async makeRequest0(command: string, data?: any, token?: CancellationToken): Promise<void> {
        await this.makeRequest<Record<string, never>>(command, data, token);
    }
}

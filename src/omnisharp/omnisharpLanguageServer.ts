/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as utils from './utils';
import { DotNetChannelObserver } from './observers/dotnetChannelObserver';
import { DotnetLoggerObserver } from './observers/dotnetLoggerObserver';
import DotNetTestLoggerObserver from './observers/dotnetTestLoggerObserver';
import DotNetTestChannelObserver from './observers/dotnetTestChannelObserver';
import { OmnisharpLoggerObserver } from './observers/omnisharpLoggerObserver';
import { OmnisharpChannelObserver } from './observers/omnisharpChannelObserver';
import { WarningMessageObserver } from './observers/warningMessageObserver';
import { InformationMessageObserver } from './observers/informationMessageObserver';
import { ErrorMessageObserver } from './observers/errorMessageObserver';
import { StatusBarItemAdapter } from '../statusBarItemAdapter';
import { OmnisharpStatusBarObserver } from './observers/omnisharpStatusBarObserver';
import { EventStream } from '../eventStream';
import { NetworkSettingsProvider } from '../networkSettings';
import { PlatformInformation } from '../shared/platform';
import { ProjectStatusBarObserver } from './observers/projectStatusBarObserver';
import { BackgroundWorkStatusBarObserver } from './observers/backgroundWorkStatusBarObserver';
import { OmnisharpDebugModeLoggerObserver } from './observers/omnisharpDebugModeLoggerObserver';
import { RazorLoggerObserver } from './observers/razorLoggerObserver';
import { RazorOmnisharpDownloader } from '../razor/razorOmnisharpDownloader';
import { omnisharpOptions, razorOptions } from '../shared/options';
import CompositeDisposable from '../compositeDisposable';
import { OmniSharpMonoResolver } from './omniSharpMonoResolver';
import { DotnetResolver } from './dotnetResolver';
import { LanguageMiddlewareFeature } from './languageMiddlewareFeature';
import { OmniSharpServer } from './server';
import { Advisor } from './features/diagnosticsProvider';
import TestManager from './features/dotnetTest';
import { OmnisharpWorkspaceDebugInformationProvider } from './omnisharpWorkspaceDebugInformationProvider';
import Disposable from '../disposable';
import registerCommands from './features/commands';
import { addAssetsIfNecessary } from '../shared/assets';
import {
    ActiveTextEditorChanged,
    OmnisharpStart,
    ProjectJsonDeprecatedWarning,
    RazorDevModeActive,
} from './omnisharpLoggingEvents';
import { DotnetWorkspaceConfigurationProvider } from '../shared/workspaceConfigurationProvider';
import { getMonoVersion } from '../utils/getMonoVersion';
import { safeLength, sum } from '../common';
import { TelemetryObserver } from './observers/telemetryObserver';
import { ITelemetryReporter } from '../shared/telemetryReporter';
import { Observable } from 'rxjs';
import { registerOmnisharpOptionChanges } from './omnisharpOptionChanges';
import { CSharpLoggerObserver } from './observers/csharpLoggerObserver';
import { showWarningMessage } from '../shared/observers/utils/showMessage';

export interface ActivationResult {
    readonly server: OmniSharpServer;
    readonly advisor: Advisor;
    readonly testManager: TestManager;
}

export async function activateOmniSharpLanguageServer(
    context: vscode.ExtensionContext,
    platformInfo: PlatformInformation,
    optionStream: Observable<void>,
    networkSettingsProvider: NetworkSettingsProvider,
    eventStream: EventStream,
    csharpChannel: vscode.OutputChannel,
    dotnetTestChannel: vscode.OutputChannel,
    dotnetChannel: vscode.OutputChannel,
    reporter: ITelemetryReporter
): Promise<ActivationResult> {
    // Set command enablement to use O# commands.
    vscode.commands.executeCommand('setContext', 'dotnet.server.activationContext', 'OmniSharp');

    const useModernNetOption = omnisharpOptions.useModernNet;
    const telemetryObserver = new TelemetryObserver(platformInfo, () => reporter, useModernNetOption);
    eventStream.subscribe(telemetryObserver.post);

    const csharpLoggerObserver = new CSharpLoggerObserver(csharpChannel);
    eventStream.subscribe(csharpLoggerObserver.post);

    const dotnetChannelObserver = new DotNetChannelObserver(dotnetChannel);
    const dotnetLoggerObserver = new DotnetLoggerObserver(dotnetChannel);
    eventStream.subscribe(dotnetChannelObserver.post);
    eventStream.subscribe(dotnetLoggerObserver.post);

    const dotnetTestChannelObserver = new DotNetTestChannelObserver(dotnetTestChannel);
    const dotnetTestLoggerObserver = new DotNetTestLoggerObserver(dotnetTestChannel);
    eventStream.subscribe(dotnetTestChannelObserver.post);
    eventStream.subscribe(dotnetTestLoggerObserver.post);

    const omnisharpChannel = vscode.window.createOutputChannel('OmniSharp Log');
    const omnisharpLogObserver = new OmnisharpLoggerObserver(omnisharpChannel, platformInfo);
    const omnisharpChannelObserver = new OmnisharpChannelObserver(omnisharpChannel);
    eventStream.subscribe(omnisharpLogObserver.post);
    eventStream.subscribe(omnisharpChannelObserver.post);

    const warningMessageObserver = new WarningMessageObserver(
        vscode,
        () => omnisharpOptions.disableMSBuildDiagnosticWarning || false
    );
    eventStream.subscribe(warningMessageObserver.post);

    const informationMessageObserver = new InformationMessageObserver(vscode);
    eventStream.subscribe(informationMessageObserver.post);

    const errorMessageObserver = new ErrorMessageObserver(vscode);
    eventStream.subscribe(errorMessageObserver.post);

    const omnisharpStatusBar = new StatusBarItemAdapter(
        vscode.window.createStatusBarItem(
            'C#-Language-Service-Status',
            vscode.StatusBarAlignment.Left,
            Number.MIN_VALUE + 2
        )
    );
    omnisharpStatusBar.name = 'C# Language Service Status';
    const omnisharpStatusBarObserver = new OmnisharpStatusBarObserver(omnisharpStatusBar);
    eventStream.subscribe(omnisharpStatusBarObserver.post);

    const projectStatusBar = new StatusBarItemAdapter(
        vscode.window.createStatusBarItem('C#-Project-Selector', vscode.StatusBarAlignment.Left, Number.MIN_VALUE + 1)
    );
    projectStatusBar.name = 'C# Project Selector';
    const projectStatusBarObserver = new ProjectStatusBarObserver(projectStatusBar);
    eventStream.subscribe(projectStatusBarObserver.post);

    const backgroundWorkStatusBar = new StatusBarItemAdapter(
        vscode.window.createStatusBarItem('C#-Code-Analysis', vscode.StatusBarAlignment.Left, Number.MIN_VALUE)
    );
    backgroundWorkStatusBar.name = 'C# Code Analysis';
    const backgroundWorkStatusBarObserver = new BackgroundWorkStatusBarObserver(backgroundWorkStatusBar);
    eventStream.subscribe(backgroundWorkStatusBarObserver.post);

    const debugMode = false;
    if (debugMode) {
        const omnisharpDebugModeLoggerObserver = new OmnisharpDebugModeLoggerObserver(omnisharpChannel);
        eventStream.subscribe(omnisharpDebugModeLoggerObserver.post);
    }

    const razorObserver = new RazorLoggerObserver(csharpChannel);
    eventStream.subscribe(razorObserver.post);

    if (!razorOptions.razorDevMode) {
        // Download Razor O# server
        const razorOmnisharpDownloader = new RazorOmnisharpDownloader(
            networkSettingsProvider,
            eventStream,
            context.extension.packageJSON,
            platformInfo,
            context.extension.extensionPath
        );

        await razorOmnisharpDownloader.DownloadAndInstallRazorOmnisharp(
            context.extension.packageJSON.defaults.razorOmnisharp
        );
    }

    registerOmnisharpOptionChanges(optionStream);

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            eventStream.post(new ActiveTextEditorChanged());
        })
    );

    // activate language services
    return activate(
        context,
        context.extension.packageJSON,
        platformInfo,
        networkSettingsProvider,
        eventStream,
        context.extension.extensionPath,
        omnisharpChannel
    );
}

async function activate(
    context: vscode.ExtensionContext,
    packageJSON: any,
    platformInfo: PlatformInformation,
    provider: NetworkSettingsProvider,
    eventStream: EventStream,
    extensionPath: string,
    outputChannel: vscode.OutputChannel
) {
    const disposables = new CompositeDisposable();

    const omnisharpMonoResolver = new OmniSharpMonoResolver(getMonoVersion);
    const omnisharpDotnetResolver = new DotnetResolver(platformInfo);

    const languageMiddlewareFeature = new LanguageMiddlewareFeature();
    languageMiddlewareFeature.register();
    disposables.add(languageMiddlewareFeature);

    const server = new OmniSharpServer(
        vscode,
        provider,
        packageJSON,
        platformInfo,
        eventStream,
        extensionPath,
        omnisharpMonoResolver,
        omnisharpDotnetResolver,
        context,
        outputChannel,
        languageMiddlewareFeature
    );
    const advisor = new Advisor(server); // create before server is started
    const testManager = new TestManager(server, eventStream, languageMiddlewareFeature);
    const workspaceInformationProvider = new OmnisharpWorkspaceDebugInformationProvider(server);

    let registrations: Disposable | undefined;
    disposables.add(
        server.onServerStart(async () => {
            registrations = await server.registerProviders(eventStream, advisor, testManager);
        })
    );

    disposables.add(
        server.onServerStop(() => {
            // remove language feature providers on stop
            registrations?.dispose();
            registrations = undefined;
        })
    );

    disposables.add(
        registerCommands(
            context,
            server,
            platformInfo,
            eventStream,
            omnisharpMonoResolver,
            omnisharpDotnetResolver,
            workspaceInformationProvider
        )
    );

    disposables.add(
        server.onServerStart(async () => {
            // Update or add tasks.json and launch.json
            await addAssetsIfNecessary(context, workspaceInformationProvider);
        })
    );

    // After server is started (and projects are loaded), check to see if there are
    // any project.json projects if the suppress option is not set. If so, notify the user about migration.
    const csharpConfig = vscode.workspace.getConfiguration('csharp');
    if (!csharpConfig.get<boolean>('suppressProjectJsonWarning')) {
        disposables.add(
            server.onServerStart(async () => {
                await utils.requestWorkspaceInformation(server).then((workspaceInfo) => {
                    if (workspaceInfo.DotNet && workspaceInfo.DotNet.Projects.length > 0) {
                        const shortMessage = vscode.l10n.t(
                            'project.json is no longer a supported project format for .NET Core applications.'
                        );
                        const moreDetailItem = vscode.l10n.t('More Detail');
                        eventStream.post(new ProjectJsonDeprecatedWarning());
                        showWarningMessage(vscode, shortMessage, moreDetailItem);
                    }
                });
            })
        );
    }

    // Send telemetry about the sorts of projects the server was started on.
    disposables.add(
        server.onServerStart(async () => {
            const measures: { [key: string]: number } = {};

            await utils.requestWorkspaceInformation(server).then((workspaceInfo) => {
                if (workspaceInfo.DotNet && workspaceInfo.DotNet.Projects.length > 0) {
                    measures['projectjson.projectcount'] = workspaceInfo.DotNet.Projects.length;
                    measures['projectjson.filecount'] = sum(workspaceInfo.DotNet.Projects, (p) =>
                        safeLength(p.SourceFiles)
                    );
                }

                if (workspaceInfo.MsBuild && workspaceInfo.MsBuild.Projects.length > 0) {
                    measures['msbuild.projectcount'] = workspaceInfo.MsBuild.Projects.length;
                    measures['msbuild.filecount'] = sum(workspaceInfo.MsBuild.Projects, (p) =>
                        safeLength(p.SourceFiles)
                    );
                    measures['msbuild.unityprojectcount'] = sum(workspaceInfo.MsBuild.Projects, (p) =>
                        p.IsUnityProject ? 1 : 0
                    );
                    measures['msbuild.netcoreprojectcount'] = sum(workspaceInfo.MsBuild.Projects, (p) =>
                        utils.isNetCoreProject(p) ? 1 : 0
                    );
                }

                // TODO: Add measurements for script.

                eventStream.post(new OmnisharpStart('OmniSharp.Start', measures));
            });
        })
    );

    disposables.add(
        server.onBeforeServerStart(async (path) => {
            if (razorOptions.razorDevMode) {
                eventStream.post(new RazorDevModeActive());
            }

            // read and store last solution or folder path
            await context.workspaceState.update('lastSolutionPathOrFolder', path);
        })
    );

    if (omnisharpOptions.autoStart) {
        await server.autoStart(context.workspaceState.get<string>('lastSolutionPathOrFolder', ''));
    }

    // stop server on deactivate
    disposables.add(
        new Disposable(() => {
            testManager.dispose();
            advisor.dispose();
            server.stop().catch((err) => console.error(err));
        })
    );

    // Register ConfigurationProvider
    disposables.add(
        vscode.debug.registerDebugConfigurationProvider(
            'coreclr',
            new DotnetWorkspaceConfigurationProvider(workspaceInformationProvider, platformInfo, outputChannel)
        )
    );

    context.subscriptions.push(disposables);

    return new Promise<ActivationResult>((resolve) =>
        server.onServerStart((_) => resolve({ server, advisor, testManager }))
    );
}

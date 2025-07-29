/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as coreclrdebug from './coreclrDebug/activate';
import * as util from './common';
import * as vscode from 'vscode';

import { ActivationFailure } from './shared/loggingEvents';
import { CsharpChannelObserver } from './shared/observers/csharpChannelObserver';
import { CsharpLoggerObserver } from './shared/observers/csharpLoggerObserver';
import { EventStream } from './eventStream';
import { PlatformInformation } from './shared/platform';
import TelemetryReporter from '@vscode/extension-telemetry';
import { vscodeNetworkSettingsProvider } from './networkSettings';
import createOptionStream from './shared/observables/createOptionStream';
import { AbsolutePathPackage } from './packageManager/absolutePathPackage';
import { downloadAndInstallPackages } from './packageManager/downloadAndInstallPackages';
import IInstallDependencies from './packageManager/IInstallDependencies';
import { installRuntimeDependencies } from './installRuntimeDependencies';
import { isValidDownload } from './packageManager/isValidDownload';
import { MigrateOptions } from './shared/migrateOptions';
import { CSharpExtensionExports, LimitedExtensionExports, OmnisharpExtensionExports } from './csharpExtensionExports';
import { getCSharpDevKit } from './utils/getCSharpDevKit';
import { commonOptions, omnisharpOptions } from './shared/options';
import { TelemetryEventNames } from './shared/telemetryEventNames';
import { checkDotNetRuntimeExtensionVersion } from './checkDotNetRuntimeExtensionVersion';
import { checkIsSupportedPlatform } from './checkSupportedPlatform';
import { activateOmniSharp } from './activateOmniSharp';
import { activateRoslyn } from './activateRoslyn';
import { CommandOption, showInformationMessage } from './shared/observers/utils/showMessage';

export async function activate(
    context: vscode.ExtensionContext
): Promise<CSharpExtensionExports | OmnisharpExtensionExports | LimitedExtensionExports | null> {
    // Start measuring the activation time
    const startActivation = process.hrtime();

    const csharpChannel = vscode.window.createOutputChannel('C#', { log: true });
    csharpChannel.trace('Activating C# Extension');

    util.setExtensionPath(context.extension.extensionPath);

    const aiKey = context.extension.packageJSON.contributes.debuggers[0].aiKey;
    const reporter = new TelemetryReporter(aiKey);
    // ensure it gets properly disposed. Upon disposal the events will be flushed.
    context.subscriptions.push(reporter);

    const eventStream = new EventStream();
    const csharpchannelObserver = new CsharpChannelObserver(csharpChannel);
    const csharpLogObserver = new CsharpLoggerObserver(csharpChannel);
    eventStream.subscribe(csharpchannelObserver.post);
    eventStream.subscribe(csharpLogObserver.post);

    let platformInfo: PlatformInformation;
    try {
        platformInfo = await PlatformInformation.GetCurrent();
    } catch (error) {
        eventStream.post(new ActivationFailure());
        throw error;
    }

    // Verify that the current platform is supported by the extension and inform the user if not.
    if (!checkIsSupportedPlatform(context, platformInfo)) {
        return null;
    }

    await checkDotNetRuntimeExtensionVersion(context);

    await MigrateOptions(vscode);
    const optionStream = createOptionStream(vscode);

    const requiredPackageIds: string[] = ['Debugger', 'Razor'];

    const csharpDevkitExtension = getCSharpDevKit();
    const useOmnisharpServer = !csharpDevkitExtension && commonOptions.useOmnisharpServer;
    if (useOmnisharpServer) {
        requiredPackageIds.push('OmniSharp');
    }

    requiredPackageIds.push('VSWebAssemblyBridge');
    const dotnetRuntimeExtensionId = 'ms-dotnettools.vscode-dotnet-runtime';
    const requiredDotnetRuntimeExtensionVersion = '2.2.3';

    const dotnetRuntimeExtension = vscode.extensions.getExtension(dotnetRuntimeExtensionId);
    const dotnetRuntimeExtensionVersion = dotnetRuntimeExtension?.packageJSON.version;
    if (lt(dotnetRuntimeExtensionVersion, requiredDotnetRuntimeExtensionVersion)) {
        const button = vscode.l10n.t('Update and reload');
        const prompt = vscode.l10n.t(
            'The {0} extension requires at least {1} of the .NET Install Tool ({2}) extension. Please update to continue',
            context.extension.packageJSON.displayName,
            requiredDotnetRuntimeExtensionVersion,
            dotnetRuntimeExtensionId
        );
        const selection = await vscode.window.showErrorMessage(prompt, button);
        if (selection === button) {
            await vscode.commands.executeCommand('workbench.extensions.installExtension', dotnetRuntimeExtensionId);
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        } else {
            throw new Error(
                vscode.l10n.t(
                    'Version {0} of the .NET Install Tool ({1}) was not found, {2} will not activate.',
                    requiredDotnetRuntimeExtensionVersion,
                    dotnetRuntimeExtensionId,
                    context.extension.packageJSON.displayName
                )
            );
        }
    if (csharpDevkitExtension) {
        requiredPackageIds.push('RoslynCopilot');
    }

    const networkSettingsProvider = vscodeNetworkSettingsProvider(vscode);
    const useFramework = useOmnisharpServer && omnisharpOptions.useModernNet !== true;
    const installDependencies: IInstallDependencies = async (dependencies: AbsolutePathPackage[]) =>
        downloadAndInstallPackages(dependencies, networkSettingsProvider, eventStream, isValidDownload);

    const runtimeDependenciesExist = await installRuntimeDependencies(
        context.extension.packageJSON,
        context.extension.extensionPath,
        installDependencies,
        eventStream,
        platformInfo,
        useFramework,
        requiredPackageIds
    );

    let activationEvent = TelemetryEventNames.CSharpActivated;
    let exports: CSharpExtensionExports | OmnisharpExtensionExports | LimitedExtensionExports;
    if (vscode.workspace.isTrusted !== true) {
        activationEvent = TelemetryEventNames.CSharpLimitedActivation;
        await vscode.commands.executeCommand('setContext', 'dotnet.server.activationContext', 'Limited');
        exports = { isLimitedActivation: true };
        csharpChannel.info('C# Extension activated in limited mode due to workspace trust not being granted.');
        context.subscriptions.push(
            vscode.workspace.onDidGrantWorkspaceTrust(() => {
                const reloadTitle: CommandOption = {
                    title: vscode.l10n.t('Reload C# Extension'),
                    command: 'workbench.action.restartExtensionHost',
                };
                const message = vscode.l10n.t(
                    'Workspace trust has changed. Would you like to reload the C# extension?'
                );
                showInformationMessage(vscode, message, reloadTitle);
            })
        );
    } else {
        // activate language services
        const dotnetTestChannel = vscode.window.createOutputChannel(vscode.l10n.t('.NET Test Log'));
        const dotnetChannel = vscode.window.createOutputChannel(vscode.l10n.t('.NET NuGet Restore'));
        omnisharpLangServicePromise = activateOmniSharpLanguageServer(
            context,
            platformInfo,
            optionStream,
            networkSettingsProvider,
            eventStream,
            csharpChannel,
            dotnetTestChannel,
            dotnetChannel,
            reporter
        );

        if (!razorOptions.razorDevMode) {
            omnisharpRazorPromise = activateRazorExtension(
                context,
                context.extension.extensionPath,
                eventStream,
                reporter,
                undefined,
                platformInfo,
                /* useOmnisharpServer */ true
            );
        }
    }

    if (!isSupportedPlatform(platformInfo)) {
        // Check to see if VS Code is running remotely
        if (context.extension.extensionKind === vscode.ExtensionKind.Workspace) {
            const setupButton: ActionOption = {
                title: vscode.l10n.t('How to setup Remote Debugging'),
                action: async () => {
                    const remoteDebugInfoURL =
                        'https://github.com/dotnet/vscode-csharp/wiki/Remote-Debugging-On-Linux-Arm';
                    await vscode.env.openExternal(vscode.Uri.parse(remoteDebugInfoURL));
                },
            };
            const errorMessage = vscode.l10n.t(
                `The C# extension for Visual Studio Code is incompatible on {0} {1} with the VS Code Remote Extensions. To see avaliable workarounds, click on '{2}'.`,
                platformInfo.platform,
                platformInfo.architecture,
                setupButton.title
            );
            showErrorMessage(vscode, errorMessage, setupButton);
        } else {
            const errorMessage = vscode.l10n.t(
                'The C# extension for Visual Studio Code is incompatible on {0} {1}.',
                platformInfo.platform,
                platformInfo.architecture
            );
            showErrorMessage(vscode, errorMessage);
        }

        // Unsupported platform
        return null;
    }

    let coreClrDebugPromise = Promise.resolve();
    if (runtimeDependenciesExist) {
        // activate coreclr-debug
        coreClrDebugPromise = coreclrdebug.activate(
            context.extension,
            context,
            platformInfo,
            eventStream,
            csharpChannel,
            roslynLanguageServerStartedPromise ?? omnisharpLangServicePromise
        );
    }

    const activationProperties: { [key: string]: string } = {
        serverKind: useOmnisharpServer ? 'OmniSharp' : 'Roslyn',
    };
    reporter.sendTelemetryEvent(TelemetryEventNames.CSharpActivated, activationProperties);

    if (!useOmnisharpServer) {
        debugSessionTracker.initializeDebugSessionHandlers(context);

        tryGetCSharpDevKitExtensionExports(csharpLogObserver);

        // If we got here, the server should definitely have been created.
        util.isNotNull(roslynLanguageServerStartedPromise);
        util.isNotNull(projectInitializationCompletePromise);

        const languageServerExport = new RoslynLanguageServerExport(roslynLanguageServerStartedPromise);
        return {
            initializationFinished: async () => {
                await coreClrDebugPromise;
                await razorLanguageServerStartedPromise;
                await roslynLanguageServerStartedPromise;
                await projectInitializationCompletePromise;
            },
            profferBrokeredServices: (container) =>
                profferBrokeredServices(context, container, roslynLanguageServerStartedPromise!),
            logDirectory: context.logUri.fsPath,
            determineBrowserType: BlazorDebugConfigurationProvider.determineBrowserType,
            experimental: {
                sendServerRequest: async (t, p, ct) => await languageServerExport.sendRequest(t, p, ct),
                languageServerEvents: roslynLanguageServerEvents,
            },
            getComponentFolder: (componentName) => {
                return getComponentFolder(componentName, languageServerOptions);
            },
            tryToUseVSDbgForMono: BlazorDebugConfigurationProvider.tryToUseVSDbgForMono,
        };
    } else {
        return {
            initializationFinished: async () => {
                const langService = await omnisharpLangServicePromise;
                await langService!.server.waitForInitialize();
                await coreClrDebugPromise;

                if (omnisharpRazorPromise) {
                    await omnisharpRazorPromise;
                }
            },
            getAdvisor: async () => {
                const langService = await omnisharpLangServicePromise;
                return langService!.advisor;
            },
            getTestManager: async () => {
                const langService = await omnisharpLangServicePromise;
                return langService!.testManager;
            },
            eventStream,
            logDirectory: context.logUri.fsPath,
        };
    }
}

/**
 * This method will try to get the CSharpDevKitExports through a thenable promise,
 * awaiting `activate` will cause this extension's activation to hang.
 */
function tryGetCSharpDevKitExtensionExports(csharpLogObserver: CsharpLoggerObserver): void {
    const ext = getCSharpDevKit();
    ext?.activate().then(
        async (exports: CSharpDevKitExports) => {
            if (exports && exports.serviceBroker) {
                // When proffering this IServiceBroker into our own container,
                // we list the monikers of the brokered services we expect to find there.
                // This list must be a subset of the monikers previously registered with our own container
                // as defined in the getBrokeredServiceContainer function.
                getBrokeredServiceContainer().profferServiceBroker(exports.serviceBroker, [
                    Descriptors.dotnetDebugConfigurationService.moniker,
                ]);

                // Notify the vsdbg configuration provider that C# dev kit has been loaded.
                exports.serverProcessLoaded(async () => {
                    await debugSessionTracker.onCsDevKitInitialized(await exports.getBrokeredServiceServerPipeName());
                });

                await vscode.commands.executeCommand('setContext', 'dotnet.debug.serviceBrokerAvailable', true);
            } else {
                csharpLogObserver.logger.appendLine(
                    `[ERROR] '${csharpDevkitExtensionId}' activated but did not return expected Exports.`
        const getCoreClrDebugPromise = async (languageServerStartedPromise: Promise<void>) => {
            let coreClrDebugPromise = Promise.resolve();
            if (runtimeDependenciesExist) {
                // activate coreclr-debug
                coreClrDebugPromise = coreclrdebug.activate(
                    context.extension,
                    context,
                    platformInfo,
                    eventStream,
                    csharpChannel,
                    languageServerStartedPromise
                );
            }

            return coreClrDebugPromise;
        };

        if (!useOmnisharpServer) {
            exports = activateRoslyn(
                context,
                platformInfo,
                optionStream,
                eventStream,
                csharpChannel,
                reporter,
                csharpDevkitExtension,
                getCoreClrDebugPromise
            );
        } else {
            exports = activateOmniSharp(
                context,
                platformInfo,
                optionStream,
                networkSettingsProvider,
                eventStream,
                csharpChannel,
                reporter,
                getCoreClrDebugPromise
            );
        }
    }

    const timeTaken = process.hrtime(startActivation);
    const timeTakenStr = (timeTaken[0] * 1000 + timeTaken[1] / 1000000).toFixed(3);
    csharpChannel.trace('C# Extension activated in ' + timeTakenStr + 'ms.');
    const activationProperties: { [key: string]: string } = {
        serverKind: useOmnisharpServer ? 'OmniSharp' : 'Roslyn',
        timeTaken: timeTakenStr,
    };
    reporter.sendTelemetryEvent(activationEvent, activationProperties);

    return exports;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as coreclrdebug from './coreclrDebug/activate.js';
import * as util from './common.js';
import * as vscode from 'vscode';

import { ActivationFailure } from './shared/loggingEvents.js';
import { CsharpChannelObserver } from './shared/observers/csharpChannelObserver.js';
import { CsharpLoggerObserver } from './shared/observers/csharpLoggerObserver.js';
import { EventStream } from './eventStream.js';
import { PlatformInformation } from './shared/platform.js';
import telemetryReporterModule from '@vscode/extension-telemetry';
import { vscodeNetworkSettingsProvider } from './networkSettings.js';
import createOptionStream from './shared/observables/createOptionStream.js';
import { AbsolutePathPackage } from './packageManager/absolutePathPackage.js';
import { IInstallDependencies } from './packageManager/IInstallDependencies.js';
import { installRuntimeDependencies } from './installRuntimeDependencies.js';
import { MigrateOptions } from './shared/migrateOptions.js';
import {
    CSharpExtensionExports,
    LimitedExtensionExports,
    OmnisharpExtensionExports,
} from './csharpExtensionExports.js';
import { getCSharpDevKit } from './utils/getCSharpDevKit.js';
import { commonOptions, omnisharpOptions } from './shared/options.js';
import { TelemetryEventNames } from './shared/telemetryEventNames.js';
import { checkDotNetRuntimeExtensionVersion } from './checkDotNetRuntimeExtensionVersion.js';
import { checkIsSupportedPlatform } from './checkSupportedPlatform.js';
import { activateRoslyn } from './activateRoslyn.js';
import { LimitedActivationStatus } from './shared/limitedActivationStatus.js';

const TelemetryReporter = telemetryReporterModule.default;

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
    if (csharpDevkitExtension && !commonOptions.disableAIFeatures) {
        requiredPackageIds.push('RoslynCopilot');
    }

    const networkSettingsProvider = vscodeNetworkSettingsProvider(vscode);
    const useFramework = useOmnisharpServer && omnisharpOptions.useModernNet !== true;
    const installDependencies: IInstallDependencies = async (dependencies: AbsolutePathPackage[]) => {
        // Defer loading the download/zip stack (yauzl, proxy agents, fs-extra, etc.) until a
        // component actually needs to be downloaded, which normally never happens after install.
        const { downloadAndInstallPackages } = await import('./packageManager/downloadAndInstallPackages.js');
        const { isValidDownload } = await import('./packageManager/isValidDownload.js');
        return downloadAndInstallPackages(
            dependencies,
            networkSettingsProvider,
            eventStream,
            isValidDownload,
            reporter
        );
    };

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
        LimitedActivationStatus.createStatusItem(context);
        context.subscriptions.push(
            // Reload extensions when workspace trust is granted
            vscode.workspace.onDidGrantWorkspaceTrust(() => {
                vscode.commands.executeCommand('workbench.action.restartExtensionHost');
            })
        );
    } else {
        const getCoreClrDebugPromise = async (languageServerStartedPromise: Promise<void>) => {
            let coreClrDebugPromise = Promise.resolve();
            if (runtimeDependenciesExist['Debugger']) {
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
            // Defer loading the OmniSharp implementation and its module graph until we actually
            // activate it, so the default Roslyn activations don't pay to compile/execute it.
            const { activateOmniSharp } = await import('./activateOmniSharp.js');
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

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
import { CSharpExtensionExports, OmnisharpExtensionExports } from './csharpExtensionExports';
import { getCSharpDevKit } from './utils/getCSharpDevKit';
import { commonOptions, omnisharpOptions } from './shared/options';
import { TelemetryEventNames } from './shared/telemetryEventNames';
import { checkDotNetRuntimeExtensionVersion } from './checkDotNetRuntimeExtensionVersion';
import { checkIsSupportedPlatform } from './checkSupportedPlatform';
import { activateOmniSharp } from './activateOmniSharp';
import { activateRoslyn } from './activateRoslyn';

export async function activate(
    context: vscode.ExtensionContext
): Promise<CSharpExtensionExports | OmnisharpExtensionExports | null> {
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

    let exports: CSharpExtensionExports | OmnisharpExtensionExports;
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

    const timeTaken = process.hrtime(startActivation);
    const timeTakenStr = (timeTaken[0] * 1000 + timeTaken[1] / 1000000).toFixed(3);
    csharpChannel.trace('C# Extension activated in ' + timeTakenStr + 'ms.');
    const activationProperties: { [key: string]: string } = {
        serverKind: useOmnisharpServer ? 'OmniSharp' : 'Roslyn',
        timeTaken: timeTakenStr,
    };
    reporter.sendTelemetryEvent(TelemetryEventNames.CSharpActivated, activationProperties);

    return exports;
}

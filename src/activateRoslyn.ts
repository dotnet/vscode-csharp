/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CSharpExtensionExports } from './csharpExtensionExports';
import { activateRazorExtension } from './razor/razor';
import { PlatformInformation } from './shared/platform';
import { Observable } from 'rxjs';
import { EventStream } from './eventStream';
import TelemetryReporter from '@vscode/extension-telemetry';
import { RoslynLanguageServer } from './lsptoolshost/server/roslynLanguageServer';
import { CSharpDevKitExports } from './csharpDevKitExports';
import { RoslynLanguageServerEvents, ServerState } from './lsptoolshost/server/languageServerEvents';
import { activateRoslynLanguageServer } from './lsptoolshost/activate';
import Descriptors from './lsptoolshost/solutionSnapshot/descriptors';
import { getBrokeredServiceContainer } from './lsptoolshost/serviceBroker/brokeredServicesHosting';
import { debugSessionTracker } from './coreclrDebug/provisionalDebugSessionTracker';
import { RoslynLanguageServerExport } from './lsptoolshost/extensions/roslynLanguageServerExportChannel';
import { BlazorDebugConfigurationProvider } from './razor/src/blazorDebug/blazorDebugConfigurationProvider';
import { languageServerOptions } from './shared/options';
import { csharpDevkitExtensionId } from './utils/getCSharpDevKit';
import { GlobalBrokeredServiceContainer } from '@microsoft/servicehub-framework';
import { SolutionSnapshotProvider } from './lsptoolshost/solutionSnapshot/solutionSnapshotProvider';
import { BuildResultDiagnostics } from './lsptoolshost/diagnostics/buildResultReporterService';
import { getComponentFolder } from './lsptoolshost/extensions/builtInComponents';

export function activateRoslyn(
    context: vscode.ExtensionContext,
    platformInfo: PlatformInformation,
    optionStream: Observable<void>,
    eventStream: EventStream,
    csharpChannel: vscode.LogOutputChannel,
    reporter: TelemetryReporter,
    csharpDevkitExtension: vscode.Extension<CSharpDevKitExports> | undefined,
    getCoreClrDebugPromise: (languageServerStarted: Promise<any>) => Promise<void>
): CSharpExtensionExports {
    const roslynLanguageServerEvents = new RoslynLanguageServerEvents();
    context.subscriptions.push(roslynLanguageServerEvents);

    // Activate Razor. Needs to be activated before Roslyn so commands are registered in the correct order.
    // Otherwise, if Roslyn starts up first, they could execute commands that don't yet exist on Razor's end.
    //
    // Flow:
    // Razor starts up and registers dynamic file info commands ->
    // Roslyn starts up and registers Razor-specific didOpen/didClose/didChange commands and sends request to Razor
    //     for dynamic file info once project system is ready ->
    // Razor sends didOpen commands to Roslyn for generated docs and responds to request with dynamic file info
    const razorLanguageServerStartedPromise = activateRazorExtension(
        context,
        context.extension.extensionPath,
        eventStream,
        reporter,
        csharpDevkitExtension,
        platformInfo,
        /* useOmnisharpServer */ false
    );

    // Setup a listener for project initialization complete before we start the server.
    const projectInitializationCompletePromise = new Promise<void>((resolve, _) => {
        roslynLanguageServerEvents.onServerStateChange(async (e) => {
            if (e.state === ServerState.ProjectInitializationComplete) {
                resolve();
            }
        });
    });

    // Start the server, but do not await the completion to avoid blocking activation.
    const roslynLanguageServerStartedPromise = activateRoslynLanguageServer(
        context,
        platformInfo,
        optionStream,
        csharpChannel,
        reporter,
        roslynLanguageServerEvents
    );

    debugSessionTracker.initializeDebugSessionHandlers(context);
    tryGetCSharpDevKitExtensionExports(csharpDevkitExtension, csharpChannel);
    const coreClrDebugPromise = getCoreClrDebugPromise(roslynLanguageServerStartedPromise);

    const languageServerExport = new RoslynLanguageServerExport(roslynLanguageServerStartedPromise);
    const exports: CSharpExtensionExports = {
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
    };

    return exports;
}

/**
 * This method will try to get the CSharpDevKitExports through a thenable promise,
 * awaiting `activate` will cause this extension's activation to hang.
 */
function tryGetCSharpDevKitExtensionExports(
    csharpDevKit: vscode.Extension<CSharpDevKitExports> | undefined,
    csharpChannel: vscode.LogOutputChannel
): void {
    csharpDevKit?.activate().then(
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
                csharpChannel.error(`'${csharpDevkitExtensionId}' activated but did not return expected Exports.`);
            }
        },
        () => {
            csharpChannel.error(`Failed to activate '${csharpDevkitExtensionId}'`);
        }
    );
}

function profferBrokeredServices(
    context: vscode.ExtensionContext,
    serviceContainer: GlobalBrokeredServiceContainer,
    languageServerPromise: Promise<RoslynLanguageServer>
) {
    context.subscriptions.push(
        serviceContainer.profferServiceFactory(
            Descriptors.solutionSnapshotProviderRegistration,
            (_mk, _op, _sb) => new SolutionSnapshotProvider(languageServerPromise)
        ),
        serviceContainer.profferServiceFactory(
            Descriptors.csharpExtensionBuildResultService,
            (_mk, _op, _sb) => new BuildResultDiagnostics(languageServerPromise)
        )
    );
}

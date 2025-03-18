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

    // Setup a listener for project initialization complete before we start the server.
    const projectInitializationCompletePromise = new Promise<void>((resolve, _) => {
        roslynLanguageServerEvents.onServerStateChange(async (e) => {
            if (e.state === ServerState.ProjectInitializationComplete) {
                resolve();
            }
        });
    });

    // Start the language server but do not wait for it to avoid blocking the extension activation.
    const roslynLanguageServerStartedPromise = getLanguageServerPromise(
        context,
        platformInfo,
        optionStream,
        eventStream,
        csharpChannel,
        reporter,
        csharpDevkitExtension,
        roslynLanguageServerEvents,
        getCoreClrDebugPromise
    );

    const languageServerExport = new RoslynLanguageServerExport(roslynLanguageServerStartedPromise);
    const exports: CSharpExtensionExports = {
        initializationFinished: async () => {
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

async function getLanguageServerPromise(
    context: vscode.ExtensionContext,
    platformInfo: PlatformInformation,
    optionStream: Observable<void>,
    eventStream: EventStream,
    csharpChannel: vscode.LogOutputChannel,
    reporter: TelemetryReporter,
    csharpDevkitExtension: vscode.Extension<CSharpDevKitExports> | undefined,
    roslynLanguageServerEvents: RoslynLanguageServerEvents,
    getCoreClrDebugPromise: (languageServerStarted: Promise<any>) => Promise<void>
): Promise<RoslynLanguageServer> {
    // It is possible we're getting asked to activate due to dev kit activating to create a new project.
    // We do not want to slow down devkit activation by taking up time on the extension host main thread.
    // So we can avoid starting the server until there is a workspace or file we can work with.
    const waitForWorkspaceOrFilePromise = new Promise<void>((resolve, _) => {
        // check if there is a workspace opened or a csharp file opened and resolve the promise.
        // if neither are true, subscribe to vscode events to resolve the promise when a workspace or csharp file is opened.
        if (
            vscode.workspace.workspaceFolders ||
            vscode.workspace.textDocuments.some((doc) => doc.languageId === 'csharp')
        ) {
            resolve();
        } else {
            csharpChannel.info('Waiting for a workspace or C# file to be opened to activate the server.');
            // Subscribe to VS Code events to resolve the promise when a workspace or C# file is opened.
            const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument((doc) => {
                if (doc.languageId === 'csharp') {
                    resolve();
                    onDidOpenTextDocument.dispose();
                }
            });

            const onDidChangeWorkspaceFolders = vscode.workspace.onDidChangeWorkspaceFolders((event) => {
                if (event.added.length > 0) {
                    resolve();
                    onDidChangeWorkspaceFolders.dispose();
                }
            });

            context.subscriptions.push(onDidOpenTextDocument, onDidChangeWorkspaceFolders);
        }
    });

    // Delay startup of language servers until there is something we can actually work with.
    await waitForWorkspaceOrFilePromise;

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

    const roslynLanguageServerStartedPromise = activateRoslynLanguageServer(
        context,
        platformInfo,
        optionStream,
        csharpChannel,
        reporter,
        roslynLanguageServerEvents
    );

    const coreClrDebugPromise = getCoreClrDebugPromise(roslynLanguageServerStartedPromise);
    debugSessionTracker.initializeDebugSessionHandlers(context);
    tryGetCSharpDevKitExtensionExports(csharpDevkitExtension, csharpChannel);

    await Promise.all([razorLanguageServerStartedPromise, roslynLanguageServerStartedPromise, coreClrDebugPromise]);
    return roslynLanguageServerStartedPromise;
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

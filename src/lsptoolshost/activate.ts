/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { registerCommands } from './commands.js';
import { registerDebugger } from './debugger/debugger.js';
import { PlatformInformation } from '../shared/platform.js';
import { ITelemetryReporterWithLevel } from '../shared/telemetryReporter.js';
import { getCSharpDevKit } from '../utils/getCSharpDevKit.js';
import { DotnetRuntimeExtensionResolver } from './dotnetRuntime/dotnetRuntimeExtensionResolver.js';
import { registerUnitTestingCommands } from './testing/unitTesting.js';
import { registerLanguageServerOptionChanges } from './options/optionChanges.js';
import { Observable } from 'rxjs';
import { RoslynLanguageServerEvents } from './server/languageServerEvents.js';
import { registerCodeActionFixAllCommands } from './diagnostics/fixAllCodeAction.js';
import { commonOptions, languageServerOptions } from '../shared/options.js';
import { registerNestedCodeActionCommands } from './diagnostics/nestedCodeAction.js';
import { registerRestoreCommands } from './projectRestore/restore.js';
import { registerMiscellaneousFileNotifier } from './workspace/miscellaneousFileNotifier.js';
import { TelemetryEventNames } from '../shared/telemetryEventNames.js';
import { WorkspaceStatus } from './workspace/workspaceStatus.js';
import { ProjectContextStatus } from './projectContext/projectContextStatus.js';
import { RoslynLanguageServer } from './server/roslynLanguageServer.js';
import { registerCopilotContextProviders } from './copilot/contextProviders.js';
import { registerCopilotChatSurvey } from './copilot/copilotChatSurvey.js';
import { registerRazorEndpoints } from './razor/razorEndpoints.js';
import { ObservableLogOutputChannel } from './logging/observableLogOutputChannel.js';
import { registerSourceGeneratorRefresh } from './generators/sourceGeneratorsRefresh.js';
import { ActivityLogCapture } from '../csharpExtensionExports.js';
import { createActivityLogCapture } from './logging/loggingUtils.js';

let _channel: ObservableLogOutputChannel;
let _traceChannel: ObservableLogOutputChannel;

/**
 * Creates and activates the Roslyn language server.
 * The returned promise will complete when the server starts.
 */
export async function activateRoslynLanguageServer(
    context: vscode.ExtensionContext,
    platformInfo: PlatformInformation,
    optionObservable: Observable<void>,
    outputChannel: ObservableLogOutputChannel,
    reporter: ITelemetryReporterWithLevel,
    languageServerEvents: RoslynLanguageServerEvents
): Promise<RoslynLanguageServer> {
    // Create a channel for outputting general logs from the language server.
    // Wrap in ObservableLogOutputChannel to enable capturing logs regardless of UI log level.
    _channel = outputChannel;
    // Create a separate channel for outputting trace logs - these are incredibly verbose and make other logs very difficult to see.
    const traceOutputChannel = vscode.window.createOutputChannel(vscode.l10n.t('C# LSP Trace Logs'), { log: true });
    _traceChannel = new ObservableLogOutputChannel(traceOutputChannel);

    reporter.sendTelemetryEvent(TelemetryEventNames.ClientInitialize);

    const hostExecutableResolver = new DotnetRuntimeExtensionResolver(
        platformInfo,
        getServerPath,
        outputChannel,
        context.extensionPath
    );
    const additionalExtensionPaths = scanExtensionPlugins();

    const languageServer = await RoslynLanguageServer.initializeAsync(
        platformInfo,
        hostExecutableResolver,
        context,
        reporter,
        additionalExtensionPaths,
        languageServerEvents,
        _channel,
        _traceChannel
    );

    registerLanguageStatusItems(context, languageServer, languageServerEvents);
    registerMiscellaneousFileNotifier(context, languageServer);
    registerCopilotContextProviders(context, languageServer, _channel);
    registerCopilotChatSurvey(context, languageServer, languageServerEvents, reporter, _channel);

    // Register any commands that need to be handled by the extension.
    registerCommands(context, languageServer, hostExecutableResolver, _channel, _traceChannel, reporter);
    registerNestedCodeActionCommands(context, languageServer, _channel);
    registerCodeActionFixAllCommands(context, languageServer, _channel);

    registerRazorEndpoints(context, languageServer, _channel, platformInfo);

    registerUnitTestingCommands(context, languageServer);

    // Register any needed debugger components that need to communicate with the language server.
    registerDebugger(context, languageServer, languageServerEvents, platformInfo, _channel);

    registerRestoreCommands(context, languageServer, _channel);

    registerSourceGeneratorRefresh(context, languageServer, _channel);

    context.subscriptions.push(registerLanguageServerOptionChanges(optionObservable));

    return languageServer;

    function scanExtensionPlugins(): string[] {
        const extensionsFromPackageJson = vscode.extensions.all.flatMap((extension) => {
            let loadPaths = extension.packageJSON.contributes?.['csharpExtensionLoadPaths'];
            if (loadPaths === undefined || loadPaths === null) {
                _channel.debug(`Extension ${extension.id} does not contribute csharpExtensionLoadPaths`);
                return [];
            }

            if (!Array.isArray(loadPaths) || loadPaths.some((loadPath) => typeof loadPath !== 'string')) {
                _channel.warn(
                    `Extension ${extension.id} has invalid csharpExtensionLoadPaths. Expected string array, found ${loadPaths}`
                );
                return [];
            }

            loadPaths = loadPaths.map((loadPath) => path.join(extension.extensionPath, loadPath));
            _channel.trace(`Extension ${extension.id} contributes csharpExtensionLoadPaths: ${loadPaths}`);
            return loadPaths;
        });
        const extensionsFromOptions = languageServerOptions.extensionsPaths ?? [];
        return extensionsFromPackageJson.concat(extensionsFromOptions);
    }
}

function registerLanguageStatusItems(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    languageServerEvents: RoslynLanguageServerEvents
) {
    // DevKit will provide an equivalent workspace status item.
    if (!getCSharpDevKit()) {
        WorkspaceStatus.createStatusItem(context, languageServerEvents);
    }
    ProjectContextStatus.createStatusItem(context, languageServer);
}

export function getServerPath(platformInfo: PlatformInformation) {
    let serverPath = process.env.DOTNET_ROSLYN_SERVER_PATH;

    if (serverPath) {
        _channel.appendLine(`Using server path override from DOTNET_ROSLYN_SERVER_PATH: ${serverPath}`);
    } else {
        serverPath = commonOptions.serverPath;
        if (!serverPath) {
            // Option not set, use the path from the extension.
            serverPath = getInstalledServerPath(platformInfo);
        }
    }

    if (!fs.existsSync(serverPath)) {
        throw new Error(`Cannot find language server in path '${serverPath}'`);
    }

    return serverPath;
}

function getInstalledServerPath(platformInfo: PlatformInformation): string {
    const clientRoot = path.dirname(fileURLToPath(import.meta.url));
    const serverFilePath = path.join(clientRoot, '..', '.roslyn', 'Microsoft.CodeAnalysis.LanguageServer');

    let extension = '';
    if (platformInfo.isWindows()) {
        extension = '.exe';
    }

    let pathWithExtension = `${serverFilePath}${extension}`;
    if (!fs.existsSync(pathWithExtension)) {
        // We might be running a platform neutral vsix which has no executable, instead we run the dll directly.
        pathWithExtension = `${serverFilePath}.dll`;
    }

    return pathWithExtension;
}

/**
 * Creates an activity log capture that collects logs from the C# and LSP trace channels.
 * Sets log levels to Trace for capture. Call dispose() to stop capturing and restore log levels.
 */
export async function createCaptureActivityLogs(languageServer: RoslynLanguageServer): Promise<ActivityLogCapture> {
    return createActivityLogCapture(languageServer, _channel, _traceChannel);
}

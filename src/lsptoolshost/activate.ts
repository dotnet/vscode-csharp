/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { registerCommands } from './commands';
import { registerDebugger } from './debugger/debugger';
import { PlatformInformation } from '../shared/platform';
import TelemetryReporter from '@vscode/extension-telemetry';
import { getCSharpDevKit } from '../utils/getCSharpDevKit';
import { DotnetRuntimeExtensionResolver } from './dotnetRuntime/dotnetRuntimeExtensionResolver';
import { registerUnitTestingCommands } from './testing/unitTesting';
import { registerLanguageServerOptionChanges } from './options/optionChanges';
import { Observable } from 'rxjs';
import { RoslynLanguageServerEvents } from './server/languageServerEvents';
import { registerRazorCommands } from './razor/razorCommands';
import { registerCodeActionFixAllCommands } from './diagnostics/fixAllCodeAction';
import { commonOptions, languageServerOptions } from '../shared/options';
import { registerNestedCodeActionCommands } from './diagnostics/nestedCodeAction';
import { registerRestoreCommands } from './projectRestore/restore';
import { registerCopilotExtension } from './copilot/copilot';
import { registerSourceGeneratedFilesContentProvider } from './generators/sourceGeneratedFilesContentProvider';
import { registerMiscellaneousFileNotifier } from './workspace/miscellaneousFileNotifier';
import { TelemetryEventNames } from '../shared/telemetryEventNames';
import { WorkspaceStatus } from './workspace/workspaceStatus';
import { ProjectContextStatus } from './projectContext/projectContextStatus';
import { RoslynLanguageServer } from './server/roslynLanguageServer';

let _channel: vscode.LogOutputChannel;
let _traceChannel: vscode.OutputChannel;

/**
 * Creates and activates the Roslyn language server.
 * The returned promise will complete when the server starts.
 */
export async function activateRoslynLanguageServer(
    context: vscode.ExtensionContext,
    platformInfo: PlatformInformation,
    optionObservable: Observable<void>,
    outputChannel: vscode.LogOutputChannel,
    reporter: TelemetryReporter,
    languageServerEvents: RoslynLanguageServerEvents
): Promise<RoslynLanguageServer> {
    // Create a channel for outputting general logs from the language server.
    _channel = outputChannel;
    // Create a separate channel for outputting trace logs - these are incredibly verbose and make other logs very difficult to see.
    // The trace channel verbosity is controlled by the _channel verbosity.
    _traceChannel = vscode.window.createOutputChannel(vscode.l10n.t('C# LSP Trace Logs'));

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
    registerCopilotExtension(languageServer, _channel);

    // Register any commands that need to be handled by the extension.
    registerCommands(context, languageServer, hostExecutableResolver, _channel);
    registerNestedCodeActionCommands(context, languageServer, _channel);
    registerCodeActionFixAllCommands(context, languageServer, _channel);

    registerRazorCommands(context, languageServer);

    registerUnitTestingCommands(context, languageServer);

    // Register any needed debugger components that need to communicate with the language server.
    registerDebugger(context, languageServer, languageServerEvents, platformInfo, _channel);

    registerRestoreCommands(context, languageServer);

    registerSourceGeneratedFilesContentProvider(context, languageServer);

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
    const clientRoot = __dirname;
    const serverFilePath = path.join(clientRoot, '..', '.roslyn', 'Microsoft.CodeAnalysis.LanguageServer');

    let extension = '';
    if (platformInfo.isWindows()) {
        extension = '.exe';
    } else if (platformInfo.isMacOS()) {
        // MacOS executables must be signed with codesign.  Currently all Roslyn server executables are built on windows
        // and therefore dotnet publish does not automatically sign them.
        // Tracking bug - https://devdiv.visualstudio.com/DevDiv/_workitems/edit/1767519/
        extension = '.dll';
    }

    let pathWithExtension = `${serverFilePath}${extension}`;
    if (!fs.existsSync(pathWithExtension)) {
        // We might be running a platform neutral vsix which has no executable, instead we run the dll directly.
        pathWithExtension = `${serverFilePath}.dll`;
    }

    return pathWithExtension;
}

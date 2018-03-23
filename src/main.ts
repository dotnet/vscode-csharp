/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as OmniSharp from './omnisharp/extension';
import * as coreclrdebug from './coreclr-debug/activate';
import * as util from './common';
import * as vscode from 'vscode';
import { CSharpExtDownloader } from './CSharpExtDownloader';
import { PlatformInformation } from './platform';
import TelemetryReporter from 'vscode-extension-telemetry';
import { addJSONProviders } from './features/json/jsonContributions';
import { CsharpChannelObserver } from './observers/CsharpChannelObserver';
import { CsharpLoggerObserver } from './observers/CsharpLoggerObserver';
import { OmnisharpLoggerObserver } from './observers/OmnisharpLoggerObserver';
import { DotNetChannelObserver } from './observers/DotnetChannelObserver';
import { TelemetryObserver } from './observers/TelemetryObserver';
import { OmnisharpChannelObserver } from './observers/OmnisharpChannelObserver';
import { DotnetLoggerObserver } from './observers/DotnetLoggerObserver';
import { OmnisharpDebugModeLoggerObserver } from './observers/OmnisharpDebugModeLoggerObserver';
import { ActivationFailure, ActiveTextEditorChanged } from './omnisharp/loggingEvents';
import { EventStream } from './EventStream';
import { OmnisharpServerStatusObserver, ExecuteCommand, ShowWarningMessage } from './observers/OmnisharpServerStatusObserver';
import { InformationMessageObserver, ShowInformationMessage, GetConfiguration, WorkspaceAsRelativePath } from './observers/InformationMessageObserver';
import { GetActiveTextEditor, OmnisharpStatusBarObserver, Match } from './observers/OmnisharpStatusBarObserver';
import { TextEditorAdapter } from './textEditorAdapter';
import { StatusBarItemAdapter } from './statusBarItemAdapter';

export async function activate(context: vscode.ExtensionContext): Promise<{ initializationFinished: Promise<void> }> {

    const extensionId = 'ms-vscode.csharp';
    const extension = vscode.extensions.getExtension(extensionId);
    const extensionVersion = extension.packageJSON.version;
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    const reporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);

    util.setExtensionPath(extension.extensionPath);

    const eventStream = new EventStream();

    let dotnetChannel = vscode.window.createOutputChannel('.NET');
    let dotnetChannelObserver = new DotNetChannelObserver(dotnetChannel);
    let dotnetLoggerObserver = new DotnetLoggerObserver(dotnetChannel);
    eventStream.subscribe(dotnetChannelObserver.post);
    eventStream.subscribe(dotnetLoggerObserver.post);

    let csharpChannel = vscode.window.createOutputChannel('C#');
    let csharpchannelObserver = new CsharpChannelObserver(csharpChannel);
    let csharpLogObserver = new CsharpLoggerObserver(csharpChannel);
    eventStream.subscribe(csharpchannelObserver.post);
    eventStream.subscribe(csharpLogObserver.post);

    let omnisharpChannel = vscode.window.createOutputChannel('OmniSharp Log');
    let omnisharpLogObserver = new OmnisharpLoggerObserver(omnisharpChannel);
    let omnisharpChannelObserver = new OmnisharpChannelObserver(omnisharpChannel);
    eventStream.subscribe(omnisharpLogObserver.post);
    eventStream.subscribe(omnisharpChannelObserver.post);

    let showWarningMessage: ShowWarningMessage = (message: string, ...items: string[]) => vscode.window.showWarningMessage(message, ...items);
    let executeCommand: ExecuteCommand = <T>(command: string, ...rest: any[]) => vscode.commands.executeCommand(command, ...rest);
    let omnisharpServerStatusObserver = new OmnisharpServerStatusObserver(showWarningMessage, executeCommand, clearTimeout, setTimeout);
    eventStream.subscribe(omnisharpServerStatusObserver.post);

    let getConfiguration: GetConfiguration = (name: string) => vscode.workspace.getConfiguration(name);
    let showInformationMessage: ShowInformationMessage = (message: string, ...items: string[]) => vscode.window.showInformationMessage(message, ...items);
    let workspaceAsRelativePath: WorkspaceAsRelativePath = (path: string, includeWorkspaceFolder?: boolean) => vscode.workspace.asRelativePath(path, includeWorkspaceFolder);
    let informationMessageObserver = new InformationMessageObserver(getConfiguration, showInformationMessage, workspaceAsRelativePath);
    eventStream.subscribe(informationMessageObserver.post);

    let omnisharpStatusBar = new StatusBarItemAdapter(vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, Number.MIN_VALUE));
    let getActiveTextEditor: GetActiveTextEditor = () => new TextEditorAdapter(vscode.window.activeTextEditor);
    let match: Match = (selector: vscode.DocumentSelector, document: any) => vscode.languages.match(selector, <vscode.TextDocument>document);
    let omnisharpStatusBarObserver = new OmnisharpStatusBarObserver(getActiveTextEditor, match, omnisharpStatusBar);
    eventStream.subscribe(omnisharpStatusBarObserver.post);

    const debugMode = false;
    if (debugMode) {
        let omnisharpDebugModeLoggerObserver = new OmnisharpDebugModeLoggerObserver(omnisharpChannel);
        eventStream.subscribe(omnisharpDebugModeLoggerObserver.post);
    }

    let platformInfo: PlatformInformation;
    try {
        platformInfo = await PlatformInformation.GetCurrent();
    }
    catch (error) {
        eventStream.post(new ActivationFailure());
    }

    let telemetryObserver = new TelemetryObserver(platformInfo, () => reporter);
    eventStream.subscribe(telemetryObserver.post);

    let runtimeDependenciesExist = await ensureRuntimeDependencies(extension, eventStream, platformInfo);

    // activate language services
    let omniSharpPromise = OmniSharp.activate(context, eventStream, extension.packageJSON, platformInfo);

    // register JSON completion & hover providers for project.json
    context.subscriptions.push(addJSONProviders());
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
        eventStream.post(new ActiveTextEditorChanged());
    }));

    let coreClrDebugPromise = Promise.resolve();
    if (runtimeDependenciesExist) {
        // activate coreclr-debug
        coreClrDebugPromise = coreclrdebug.activate(extension, context, platformInfo, eventStream);
    }

    return {
        initializationFinished: Promise.all([omniSharpPromise, coreClrDebugPromise])
            .then(promiseResult => {
                // This promise resolver simply swallows the result of Promise.all. When we decide we want to expose this level of detail
                // to other extensions then we will design that return type and implement it here.
            })
    };
}

function ensureRuntimeDependencies(extension: vscode.Extension<any>, eventStream: EventStream, platformInfo: PlatformInformation): Promise<boolean> {
    return util.installFileExists(util.InstallFileType.Lock)
        .then(exists => {
            if (!exists) {
                const downloader = new CSharpExtDownloader(eventStream, extension.packageJSON, platformInfo);
                return downloader.installRuntimeDependencies();
            } else {
                return true;
            }
        });
}


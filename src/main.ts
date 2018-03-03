/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as OmniSharp from './omnisharp/extension';
import * as coreclrdebug from './coreclr-debug/activate';
import * as util from './common';
import * as vscode from 'vscode';

import { Message, MessageObserver, MessageType } from './omnisharp/messageType';
import { CSharpExtDownloader } from './CSharpExtDownloader';
import { Logger } from './logger';
import { PlatformInformation } from './platform';
import { Subject } from 'rx';
import TelemetryReporter from 'vscode-extension-telemetry';
import { addJSONProviders } from './features/json/jsonContributions';
import { CsharpChannelObserver } from './omnisharp/observers/CsharpChannelObserver';
import { CsharpLoggerObserver } from './omnisharp/observers/CsharpLoggerObserver';
import { OmnisharpLoggerObserver } from './omnisharp/observers/OmnisharpLoggerObserver';
import { DotNetChannelObserver } from './omnisharp/observers/DotnetChannelObserver';
import { TelemetryObserver } from './omnisharp/observers/TelemetryObserver';
import { OmnisharpChannelObserver } from './omnisharp/observers/OmnisharpChannelObserver';

export async function activate(context: vscode.ExtensionContext): Promise<{ initializationFinished: Promise<void> }> {

    const extensionId = 'ms-vscode.csharp';
    const extension = vscode.extensions.getExtension(extensionId);
    const extensionVersion = extension.packageJSON.version;
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    const reporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);

    util.setExtensionPath(extension.extensionPath);

    let csharpChannel = vscode.window.createOutputChannel('C#');
    let csharpLogger = new Logger(text => csharpChannel.append(text));
    let omnisharpChannel = vscode.window.createOutputChannel('OmniSharp Log');
    let omnisharpLogObserver = new OmnisharpLoggerObserver(() => new Logger(message => omnisharpChannel.append(message)), false);
    let omnisharpChannelObserver = new OmnisharpChannelObserver(() => omnisharpChannel);
    let csharpchannelObserver = new CsharpChannelObserver(() => csharpChannel);
    let csharpLogObserver = new CsharpLoggerObserver(() => csharpLogger);
    let dotnetChannel = vscode.window.createOutputChannel('.NET');
    let dotnetChannelObserver = new DotNetChannelObserver(() => dotnetChannel);

    const sink = new Subject<Message>();
    sink.subscribe(omnisharpLogObserver.onNext);
    sink.subscribe(omnisharpChannelObserver.onNext);
    sink.subscribe(csharpchannelObserver.onNext);
    sink.subscribe(csharpLogObserver.onNext);
    sink.subscribe(dotnetChannelObserver.onNext);
   let platformInfo: PlatformInformation;
    try {
        platformInfo = await PlatformInformation.GetCurrent();
    }
    catch (error) {
        sink.onNext({ type: MessageType.ActivationFailure });
    }

    let telemetryObserver = new TelemetryObserver(platformInfo, () => reporter);
    sink.subscribe(telemetryObserver.onNext);

    let runtimeDependenciesExist = await ensureRuntimeDependencies(extension, sink, platformInfo);

    // activate language services
    let omniSharpPromise = OmniSharp.activate(context, sink, extension.packageJSON, platformInfo);

    // register JSON completion & hover providers for project.json
    context.subscriptions.push(addJSONProviders());

    let coreClrDebugPromise = Promise.resolve();
    if (runtimeDependenciesExist) {
        // activate coreclr-debug
        coreClrDebugPromise = coreclrdebug.activate(extension, context, platformInfo, sink);
    }

    return {
        initializationFinished: Promise.all([omniSharpPromise, coreClrDebugPromise])
        .then(promiseResult => {
            // This promise resolver simply swallows the result of Promise.all. When we decide we want to expose this level of detail
            // to other extensions then we will design that return type and implement it here.
        })
    };
}

function ensureRuntimeDependencies(extension: vscode.Extension<any>, sink: MessageObserver, platformInfo: PlatformInformation): Promise<boolean> {
    return util.installFileExists(util.InstallFileType.Lock)
        .then(exists => {
            if (!exists) {
                const downloader = new CSharpExtDownloader(sink, extension.packageJSON, platformInfo);
                return downloader.installRuntimeDependencies();
            } else {
                return true;
            }
        });
}


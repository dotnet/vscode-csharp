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
import { TelemetryObserver } from './omnisharp/telemetryObserver';
import TelemetryReporter from 'vscode-extension-telemetry';
import { addJSONProviders } from './features/json/jsonContributions';
import { csharpChannelObserver } from './omnisharp/csharpChannelObserver';
import { csharpLoggerObserver } from './omnisharp/csharpLoggerObserver';
import { omnisharpLoggerObserver } from './omnisharp/omnisharpLoggerObserver';

let csharpChannel: vscode.OutputChannel = null;

export async function activate(context: vscode.ExtensionContext): Promise<{ initializationFinished: Promise<void> }> {

    const extensionId = 'ms-vscode.csharp';
    const extension = vscode.extensions.getExtension(extensionId);
    const extensionVersion = extension.packageJSON.version;
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    const reporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);

    util.setExtensionPath(extension.extensionPath);

    csharpChannel = vscode.window.createOutputChannel('C#');

    let csharpLogger = new Logger(text => csharpChannel.append(text));


    const sink = new Subject<Message>();
    let omnisharpChannel = vscode.window.createOutputChannel('OmniSharp Log');
    let omnisharpLogObserver = new omnisharpLoggerObserver(() => new Logger(message => omnisharpChannel.append(message)), false);
    let csharpchannelObserver = new csharpChannelObserver(() => csharpChannel);
    let csharpLogObserver = new csharpLoggerObserver(() => csharpLogger);
    let dotnetChannel = vscode.window.createOutputChannel('.NET');
    sink.subscribe(omnisharpLogObserver.onNext);
    sink.subscribe(csharpchannelObserver.onNext);
    sink.subscribe(csharpLogObserver.onNext);

    let platformInfo: PlatformInformation;

    try {
        platformInfo = await PlatformInformation.GetCurrent();
    }
    catch (error) {
        sink.onNext({ type: MessageType.ActivationFailure});
    }
    
    let telemetryObserver = new TelemetryObserver(platformInfo, () => reporter);
    sink.subscribe(telemetryObserver.onNext);
    
    let runtimeDependenciesExist = await ensureRuntimeDependencies(extension, sink, platformInfo);

    // activate language services
    let omniSharpPromise = OmniSharp.activate(context, reporter, sink, extension.packageJSON);

    // register JSON completion & hover providers for project.json
    context.subscriptions.push(addJSONProviders());

    let coreClrDebugPromise = Promise.resolve();
    if (runtimeDependenciesExist) {
        // activate coreclr-debug
        coreClrDebugPromise = coreclrdebug.activate(extension, context, reporter, csharpLogger, csharpChannel);
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


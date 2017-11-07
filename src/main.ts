/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as OmniSharp from './omnisharp/extension';
import * as coreclrdebug from './coreclr-debug/activate';
import * as util from './common';
import * as vscode from 'vscode';

import { CSharpExtDownloader } from './CSharpExtDownloader';
import { Logger } from './logger';
import TelemetryReporter from 'vscode-extension-telemetry';
import { addJSONProviders } from './features/json/jsonContributions';

let _channel: vscode.OutputChannel = null;

export async function activate(context: vscode.ExtensionContext): Promise<{ initializationFinished: Promise<void> }> {

    const extensionId = 'ms-vscode.csharp';
    const extension = vscode.extensions.getExtension(extensionId);
    const extensionVersion = extension.packageJSON.version;
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    const reporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);

    util.setExtensionPath(extension.extensionPath);

    _channel = vscode.window.createOutputChannel('C#');

    let logger = new Logger(text => _channel.append(text));

    let runtimeDependenciesExist = await ensureRuntimeDependencies(extension, logger, reporter);
    
    // activate language services
    let omniSharpPromise = OmniSharp.activate(context, reporter, _channel);

    // register JSON completion & hover providers for project.json
    context.subscriptions.push(addJSONProviders());
    
    let coreClrDebugPromise = Promise.resolve();
    if (runtimeDependenciesExist) {
        // activate coreclr-debug
        coreClrDebugPromise = coreclrdebug.activate(extension, context, reporter, logger, _channel);
    }
    
    return {
        initializationFinished: Promise.all([omniSharpPromise, coreClrDebugPromise])
        .then(a => {})
    };
}

function ensureRuntimeDependencies(extension: vscode.Extension<any>, logger: Logger, reporter: TelemetryReporter): Promise<boolean> {
    return util.installFileExists(util.InstallFileType.Lock)
        .then(exists => {
            if (!exists) {
                const downloader = new CSharpExtDownloader(_channel, logger, reporter, extension.packageJSON);
                return downloader.installRuntimeDependencies();
            } else {
                return true;
            }
        });
}


/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

import * as coreclrdebug from './coreclr-debug/activate';
import * as OmniSharp from './omnisharp/extension';
import * as util from './common';
import { Logger } from './logger';
import { CSharpExtDownloader } from './CSharpExtDownloader';
import { addJSONProviders } from './features/json/jsonContributions';

let _channel: vscode.OutputChannel = null;

export function activate(context: vscode.ExtensionContext): any {

    const extensionId = 'ms-vscode.csharp';
    const extension = vscode.extensions.getExtension(extensionId);
    const extensionVersion = extension.packageJSON.version;
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    const reporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);

    util.setExtensionPath(extension.extensionPath);

    _channel = vscode.window.createOutputChannel('C#');

    let logger = new Logger(text => _channel.append(text));

    ensureRuntimeDependencies(extension, logger, reporter)
        .then((success : boolean) => {
            // activate language services
            OmniSharp.activate(context, reporter, _channel);

            // register JSON completion & hover providers for project.json
            context.subscriptions.push(addJSONProviders());
            
            if (success) {
                // activate coreclr-debug
                coreclrdebug.activate(extension, context, reporter, logger, _channel);
            }
        });
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


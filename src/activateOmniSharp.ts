/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { OmnisharpExtensionExports } from './csharpExtensionExports';
import { PlatformInformation } from './shared/platform';
import { Observable } from 'rxjs';
import { NetworkSettingsProvider } from './networkSettings';
import TelemetryReporter from '@vscode/extension-telemetry';
import { activateOmniSharpLanguageServer } from './omnisharp/omnisharpLanguageServer';
import { EventStream } from './eventStream';
import { razorOptions } from './shared/options';
import { activateRazorExtension } from './razor/razor';

export function activateOmniSharp(
    context: vscode.ExtensionContext,
    platformInfo: PlatformInformation,
    optionStream: Observable<void>,
    networkSettingsProvider: NetworkSettingsProvider,
    eventStream: EventStream,
    csharpChannel: vscode.OutputChannel,
    reporter: TelemetryReporter,
    getCoreClrDebugPromise: (languageServerStarted: Promise<any>) => Promise<void>
): OmnisharpExtensionExports {
    // activate language services
    const dotnetTestChannel = vscode.window.createOutputChannel(vscode.l10n.t('.NET Test Log'));
    const dotnetChannel = vscode.window.createOutputChannel(vscode.l10n.t('.NET NuGet Restore'));
    const omnisharpLangServicePromise = activateOmniSharpLanguageServer(
        context,
        platformInfo,
        optionStream,
        networkSettingsProvider,
        eventStream,
        csharpChannel,
        dotnetTestChannel,
        dotnetChannel,
        reporter
    );

    let omnisharpRazorPromise: Promise<void> | undefined = undefined;
    if (!razorOptions.razorDevMode) {
        omnisharpRazorPromise = activateRazorExtension(
            context,
            context.extension.extensionPath,
            eventStream,
            reporter,
            undefined,
            platformInfo,
            /* useOmnisharpServer */ true
        );
    }

    const coreClrDebugPromise = getCoreClrDebugPromise(omnisharpLangServicePromise);

    const exports: OmnisharpExtensionExports = {
        initializationFinished: async () => {
            const langService = await omnisharpLangServicePromise;
            await langService!.server.waitForInitialize();
            await coreClrDebugPromise;

            if (omnisharpRazorPromise) {
                await omnisharpRazorPromise;
            }
        },
        getAdvisor: async () => {
            const langService = await omnisharpLangServicePromise;
            return langService!.advisor;
        },
        getTestManager: async () => {
            const langService = await omnisharpLangServicePromise;
            return langService!.testManager;
        },
        eventStream,
        logDirectory: context.logUri.fsPath,
    };

    return exports;
}

/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import * as semver from "semver";
import { getDotnetInfo } from "../utils/getDotnetInfo";
import { Options } from "../shared/options";
import { getMonoVersion } from "../utils/getMonoVersion";
import { OmniSharpMonoResolver } from "./OmniSharpMonoResolver";
import { getMSBuildVersion } from "../utils/getMSBuildInfo";

export interface RequirementResult {
    needsDotNetSdk: boolean;
    needsMono: boolean;
    needsMSBuildTools: boolean;
}

export async function validateRequirements(options: Options): Promise<boolean> {
    const result = await checkRequirements(options);

    if (result.needsDotNetSdk) {
        const downloadSdk = await promptToDownloadDotNetSDK();

        if (downloadSdk === PromptResult.Yes) {
            const dotnetcoreURL = 'https://dot.net/core-sdk-vscode';
            vscode.env.openExternal(vscode.Uri.parse(dotnetcoreURL));
        } else if (downloadSdk === PromptResult.No) {
            vscode.commands.executeCommand('workbench.action.openGlobalSettings');
        }

        return false;
    }

    if (result.needsMono
        || result.needsMSBuildTools) { // Since we are currently not checking for MSBuild Tools on Windows this indicates a partial install of Mono.

        const downloadMono = await promptToDownloadMono();

        if (downloadMono === PromptResult.Yes) {
            const monoURL = 'https://www.mono-project.com/download/stable/';
            vscode.env.openExternal(vscode.Uri.parse(monoURL));
        } else if (downloadMono === PromptResult.No) {
            vscode.commands.executeCommand('workbench.action.openGlobalSettings');
        }

        return false;
    }

    return true;
}

async function checkRequirements(options: Options): Promise<RequirementResult> {
    if (options.omnisharpOptions.useModernNet) {
        const dotnetInfo = await getDotnetInfo(options.omnisharpOptions.dotNetCliPaths);
        const needsDotNetSdk = dotnetInfo.Version === undefined || semver.lt(dotnetInfo.Version, '6.0.0');
        return {
            needsDotNetSdk,
            needsMono: false,
            needsMSBuildTools: false,
        };
    }

    if (process.platform === 'win32') {
        // Need to determine way to surface missing MSBuild Tools for windows.
        return {
            needsMSBuildTools: false,
            needsDotNetSdk: false,
            needsMono: false,
        };
    }
    else {
        const monoResolver = new OmniSharpMonoResolver(getMonoVersion);
        let monoError = false;
        try {
            await monoResolver.getHostExecutableInfo(options);
        } catch (e) {
            monoError = true;
        }

        const msbuildVersion = await getMSBuildVersion();

        return {
            needsMono: monoError,
            needsDotNetSdk: false,
            needsMSBuildTools: msbuildVersion === undefined,
        };
    }
}

enum PromptResult {
    Dismissed,
    Yes,
    No
}

interface PromptItem extends vscode.MessageItem {
    result: PromptResult;
}

async function promptToDownloadDotNetSDK() {
    return new Promise<PromptResult>((resolve, _) => {
        const message = 'OmniSharp requires an install of the .NET SDK to provide language services when `omnisharp.useModernNet` is enabled in Settings. Please install the latest .NET SDK and restart vscode. If you continue see this error after installing .NET and restarting vscode, you may need to log out and log back in or restart your system for changes to the PATH to take effect.';

        const messageOptions: vscode.MessageOptions = { modal: true };

        const yesItem: PromptItem = { title: 'Get the SDK', result: PromptResult.Yes };
        const noItem: PromptItem = { title: 'Open settings', result: PromptResult.No, isCloseAffordance: true };

        vscode.window.showErrorMessage(message, messageOptions, noItem, yesItem)
            .then(selection => resolve(selection?.result ?? PromptResult.Dismissed));
    });
}

async function promptToDownloadMono() {
    return new Promise<PromptResult>((resolve, _) => {
        const message = 'OmniSharp requires a complete install of Mono (including MSBuild) to provide language services when `omnisharp.useModernNet` is disabled in Settings. Please install the latest Mono and restart.';

        const messageOptions: vscode.MessageOptions = { modal: true };

        const yesItem: PromptItem = { title: 'Download Mono', result: PromptResult.Yes };
        const noItem: PromptItem = { title: 'Open settings', result: PromptResult.No, isCloseAffordance: true };

        vscode.window.showErrorMessage(message, messageOptions, noItem, yesItem)
            .then(selection => resolve(selection?.result ?? PromptResult.Dismissed));
    });
}

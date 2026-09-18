/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as semver from 'semver';
import { getDotnetInfo } from '../shared/utils/getDotnetInfo';
import { omnisharpOptions } from '../shared/options';

export interface RequirementResult {
    needsDotNetSdk: boolean;
}

export async function validateRequirements(): Promise<boolean> {
    const result = await checkRequirements();

    if (result.needsDotNetSdk) {
        const downloadSdk = await promptToDownloadDotNetSDK();

        if (downloadSdk === PromptResult.Yes) {
            const dotnetcoreURL = 'https://dot.net/core-sdk-vscode';
            await vscode.env.openExternal(vscode.Uri.parse(dotnetcoreURL));
        }

        return false;
    }

    return true;
}

async function checkRequirements(): Promise<RequirementResult> {
    const dotnetInfo = await getDotnetInfo(omnisharpOptions.dotNetCliPaths);
    return {
        needsDotNetSdk: dotnetInfo.Version === undefined || semver.lt(dotnetInfo.Version, '10.0.0'),
    };
}

enum PromptResult {
    Dismissed,
    Yes,
}

interface PromptItem extends vscode.MessageItem {
    result: PromptResult;
}

async function promptToDownloadDotNetSDK() {
    return new Promise<PromptResult>((resolve, _) => {
        const message =
            'OmniSharp requires the .NET 10 SDK to provide language services. Please install the latest .NET 10 SDK and restart VS Code. If you continue to see this error, you may need to restart your system for changes to the PATH to take effect.';

        const messageOptions: vscode.MessageOptions = { modal: true };

        const yesItem: PromptItem = { title: 'Get the SDK', result: PromptResult.Yes };

        void vscode.window
            .showErrorMessage(message, messageOptions, yesItem)
            .then((selection) => resolve(selection?.result ?? PromptResult.Dismissed));
    });
}

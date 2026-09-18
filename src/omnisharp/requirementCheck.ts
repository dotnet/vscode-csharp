/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';

export async function validateRequirements(dotnetResolver: IHostExecutableResolver): Promise<boolean> {
    try {
        await dotnetResolver.getHostExecutableInfo();
        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        const downloadSdk = await promptToDownloadDotNetSDK(message);

        if (downloadSdk === PromptResult.Yes) {
            const dotnetcoreURL = 'https://dot.net/core-sdk-vscode';
            await vscode.env.openExternal(vscode.Uri.parse(dotnetcoreURL));
        }

        return false;
    }
}

enum PromptResult {
    Dismissed,
    Yes,
}

interface PromptItem extends vscode.MessageItem {
    result: PromptResult;
}

async function promptToDownloadDotNetSDK(reason: string) {
    return new Promise<PromptResult>((resolve, _) => {
        const message = `OmniSharp requires the .NET 10 SDK to provide language services. ${reason} Please install the latest .NET 10 SDK and restart VS Code. If you continue to see this error, you may need to restart your system for changes to the PATH to take effect.`;

        const messageOptions: vscode.MessageOptions = { modal: true };

        const yesItem: PromptItem = { title: 'Get the SDK', result: PromptResult.Yes };

        void vscode.window
            .showErrorMessage(message, messageOptions, yesItem)
            .then((selection) => resolve(selection?.result ?? PromptResult.Dismissed));
    });
}

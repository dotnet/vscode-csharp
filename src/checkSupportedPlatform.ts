/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { PlatformInformation } from './shared/platform';
import { ActionOption, showErrorMessage } from './shared/observers/utils/showMessage';

export function checkIsSupportedPlatform(context: vscode.ExtensionContext, platformInfo: PlatformInformation): boolean {
    if (!isSupportedPlatform(platformInfo)) {
        // Check to see if VS Code is running remotely
        if (context.extension.extensionKind === vscode.ExtensionKind.Workspace) {
            const setupButton: ActionOption = {
                title: vscode.l10n.t('How to setup Remote Debugging'),
                action: async () => {
                    const remoteDebugInfoURL =
                        'https://github.com/dotnet/vscode-csharp/wiki/Remote-Debugging-On-Linux-Arm';
                    await vscode.env.openExternal(vscode.Uri.parse(remoteDebugInfoURL));
                },
            };
            const errorMessage = vscode.l10n.t(
                `The C# extension for Visual Studio Code is incompatible on {0} {1} with the VS Code Remote Extensions. To see avaliable workarounds, click on '{2}'.`,
                platformInfo.platform,
                platformInfo.architecture,
                setupButton.title
            );
            showErrorMessage(vscode, errorMessage, setupButton);
        } else {
            const errorMessage = vscode.l10n.t(
                'The C# extension for Visual Studio Code is incompatible on {0} {1}.',
                platformInfo.platform,
                platformInfo.architecture
            );
            showErrorMessage(vscode, errorMessage);
        }

        // Unsupported platform
        return false;
    }

    return true;
}

function isSupportedPlatform(platform: PlatformInformation): boolean {
    if (platform.isWindows()) {
        return platform.architecture === 'x86_64' || platform.architecture === 'arm64';
    }

    if (platform.isMacOS()) {
        return true;
    }

    if (platform.isLinux()) {
        return (
            platform.architecture === 'x86_64' ||
            platform.architecture === 'x86' ||
            platform.architecture === 'i686' ||
            platform.architecture === 'arm64'
        );
    }

    return false;
}

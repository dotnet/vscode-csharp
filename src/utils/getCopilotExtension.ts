/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export const copilotExtensionId = 'github.copilot';
export const copilotChatExtensionId = 'github.copilot-chat';

export function isCopilotExtensionInstalled(): boolean {
    return (
        vscode.extensions.getExtension(copilotExtensionId) !== undefined ||
        vscode.extensions.getExtension(copilotChatExtensionId) !== undefined
    );
}

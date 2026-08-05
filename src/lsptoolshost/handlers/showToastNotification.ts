/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageClient } from '../server/roslynLanguageClient.ts';
import { MessageType } from 'vscode-languageclient';
import { ShowToastNotification } from '../server/roslynProtocol.ts';
import {
    showErrorMessage,
    showInformationMessage,
    showWarningMessage,
} from '../../shared/observers/utils/showMessage.ts';

export function registerShowToastNotification(client: RoslynLanguageClient) {
    client.onNotification(ShowToastNotification.type, async (notification) => {
        const buttonOptions = notification.commands.map((command) => {
            return {
                title: command.title,
                command: command.command,
                arguments: command.arguments,
            };
        });

        switch (notification.messageType) {
            case MessageType.Error: {
                showErrorMessage(vscode, notification.message, ...buttonOptions);
                break;
            }
            case MessageType.Warning: {
                showWarningMessage(vscode, notification.message, ...buttonOptions);
                break;
            }
            default: {
                showInformationMessage(vscode, notification.message, ...buttonOptions);
                break;
            }
        }
    });
}

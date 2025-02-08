/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageClient } from '../server/roslynLanguageClient';
import { MessageType } from 'vscode-languageserver-protocol';
import { ShowToastNotification } from '../server/roslynProtocol';
import { showErrorMessage, showInformationMessage, showWarningMessage } from '../../shared/observers/utils/showMessage';

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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageClient } from './roslynLanguageClient';
import { MessageType } from 'vscode-languageserver-protocol';
import { ShowToastNotification } from './roslynProtocol';

export function registerShowToastNotification(client: RoslynLanguageClient) {
    client.onNotification(ShowToastNotification.type, async (notification) => {
        const messageOptions: vscode.MessageOptions = {
            modal: false,
        };
        const commands = notification.commands.map((command) => command.title);
        const executeCommandByName = async (result: string | undefined) => {
            if (result) {
                const command = notification.commands.find((command) => command.title === result);
                if (!command) {
                    throw new Error(`Unknown command ${result}`);
                }

                if (command.arguments) {
                    await vscode.commands.executeCommand(command.command, ...command.arguments);
                } else {
                    await vscode.commands.executeCommand(command.command);
                }
            }
        };

        switch (notification.messageType) {
            case MessageType.Error: {
                const result = await vscode.window.showErrorMessage(notification.message, messageOptions, ...commands);
                executeCommandByName(result);
                break;
            }
            case MessageType.Warning: {
                const result = await vscode.window.showWarningMessage(
                    notification.message,
                    messageOptions,
                    ...commands
                );
                executeCommandByName(result);
                break;
            }
            default: {
                const result = await vscode.window.showInformationMessage(
                    notification.message,
                    messageOptions,
                    ...commands
                );
                executeCommandByName(result);
                break;
            }
        }
    });
}

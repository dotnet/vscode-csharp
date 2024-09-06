/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageOptions, vscode } from '../../../vscodeAdapter';

/**
 * Show an error message toast.
 * This function returns immediately and does not wait for the user to select an option or dismiss the message.
 */
export function showErrorMessage(
    vscode: vscode,
    message: string,
    ...items: (CommandOption | ActionOption | string)[]
): void {
    showErrorMessageWithOptions(vscode, message, undefined, ...items);
}

/**
 * Show an error message with specific options.
 * This function returns immediately and does not wait for the user to select an option or dismiss the message.
 */
export function showErrorMessageWithOptions(
    vscode: vscode,
    message: string,
    options: MessageOptions | undefined,
    ...items: (CommandOption | ActionOption | string)[]
): void {
    showMessage(vscode, vscode.window.showErrorMessage, message, options, ...items);
}

/**
 * Show a warning message toast.
 * This function returns immediately and does not wait for the user to select an option or dismiss the message.
 */
export function showWarningMessage(
    vscode: vscode,
    message: string,
    ...items: (CommandOption | ActionOption | string)[]
) {
    showMessage(vscode, vscode.window.showWarningMessage, message, undefined, ...items);
}

/**
 * Show an information message toast.
 * This function returns immediately and does not wait for the user to select an option or dismiss the message.
 */
export function showInformationMessage(
    vscode: vscode,
    message: string,
    ...items: (CommandOption | ActionOption | string)[]
) {
    showMessage(vscode, vscode.window.showInformationMessage, message, undefined, ...items);
}

/**
 * A message option that will trigger a command when selected.
 */
export type CommandOption = { title: string; command: string; arguments?: any[] };

/**
 * A message option that will trigger an action when selected.
 */
export type ActionOption = { title: string; action: () => Promise<void> };

type showMessageFunc = (
    message: string,
    options: MessageOptions,
    ...items: (CommandOption | ActionOption | string)[]
) => Thenable<(CommandOption | ActionOption | string) | undefined>;

function showMessage(
    vscode: vscode,
    delegateFunc: showMessageFunc,
    message: string,
    options: MessageOptions | undefined,
    ...items: (CommandOption | ActionOption | string)[]
) {
    const messageOptions = options === undefined ? {} : options;
    delegateFunc(message, messageOptions, ...items).then(
        async (selectedItem) => {
            if (selectedItem) {
                const item = items.find((i) => i);
                if (item === undefined) {
                    // This should never happen - we got an item back that we didn't provide
                    throw new Error(
                        `Could not find item with message: ${selectedItem}; items:${JSON.stringify(items)}`
                    );
                }
                if (typeof item === 'string') {
                    return;
                } else if ('action' in item && item.action) {
                    await item.action();
                } else if ('command' in item && item.command) {
                    if (item.arguments) {
                        await vscode.commands.executeCommand(item.command, ...item.arguments);
                    } else {
                        await vscode.commands.executeCommand(item.command);
                    }
                }
            }
        },
        (rejected) => {
            console.log(rejected);
        }
    );
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from "../../vscodeAdapter";
import MessageItemWithCommand from "./MessageItemWithCommand";

export default async function showWarningMessage(vscode: vscode, message: string, ...items: MessageItemWithCommand[]) {
    try {
        let value = await vscode.window.showWarningMessage<MessageItemWithCommand>(message, ...items);
        if (value && value.command) {
            await vscode.commands.executeCommand<string>(value.command);
        }
    }
    catch (err) {
        console.log(err);
    }
}
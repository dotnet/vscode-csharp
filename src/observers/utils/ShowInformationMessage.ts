/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from "../../vscodeAdapter";
import MessageItemWithCommand from "./MessageItemWithCommand";

export default async function showInformationMessage(vscode: vscode, message: string, ...items: MessageItemWithCommand[]) {
    try {
        let value = await vscode.window.showInformationMessage<MessageItemWithCommand>(message, ...items);
        if (value && value.command) {
            vscode.commands.executeCommand(value.command);
        }
    }
    catch (err) {
        console.log(err);
    }
}
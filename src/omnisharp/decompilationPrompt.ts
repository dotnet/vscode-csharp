/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import OptionProvider from "../observers/OptionProvider";

export async function getDecompilationAuthorization(context: vscode.ExtensionContext, optionProvider: OptionProvider) {
    // If decompilation is disabled the return false
    const options = optionProvider.GetLatestOptions();
    if (options.enableDecompilationSupport === false) {
        return false;
    }

    // If the terms have been acknowledged for this workspace then return.
    let decompilationAutorized = context.workspaceState.get<boolean | undefined>("decompilationAuthorized");
    if (decompilationAutorized !== undefined) {
        return decompilationAutorized;
    }

    const result = await promptToAcceptDecompilationTerms();
    decompilationAutorized = result === PromptResult.Yes;

    await context.workspaceState.update("decompilationAuthorized", decompilationAutorized);

    return decompilationAutorized;
}

enum PromptResult {
    Dismissed,
    Yes,
    No
}

interface PromptItem extends vscode.MessageItem {
    result: PromptResult;
}

async function promptToAcceptDecompilationTerms() {
    return new Promise<PromptResult>((resolve, reject) => {
        const message = `IMPORTANT: C# extension includes decompiling functionality (“Decompiler”) that enables reproducing source code from binary code. By accessing and using the Decompiler, you agree to the terms for the Decompiler below. If you do not agree with these terms, do not access or use the Decompiler.

You acknowledge that binary code and source code might be protected by copyright and trademark laws.  Before using the Decompiler on any binary code, you need to first:

(i) confirm that the license terms governing your use of the binary code do not contain a provision which prohibits you from decompiling the software; or

(ii) obtain permission to decompile the binary code from the owner of the software.

Your use of the Decompiler is optional.  Microsoft is not responsible and disclaims all liability for your use of the Decompiler that violates any laws or any software license terms which prohibit decompiling of the software.

I agree to all of the foregoing:`;

        const messageOptions: vscode.MessageOptions = { modal: true };

        const yesItem: PromptItem = { title: 'Yes', result: PromptResult.Yes };
        const noItem: PromptItem = { title: 'No', result: PromptResult.No, isCloseAffordance: true };

        vscode.window.showWarningMessage(message, messageOptions, noItem, yesItem)
            .then(selection => resolve(selection?.result ?? PromptResult.Dismissed));
    });
}
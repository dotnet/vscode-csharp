/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

export async function htmlLanguageFeaturesExtensionReady() {
    let extension = vscode.extensions.getExtension<any>('vscode.html-language-features');

    if (!extension.isActive) {
        await extension.activate();
    }
}

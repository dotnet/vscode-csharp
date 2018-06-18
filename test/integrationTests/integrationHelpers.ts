/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import CSharpExtensionExports from '../../src/CSharpExtensionExports';

export async function activateCSharpExtension(): Promise<void> {
    const csharpExtension = vscode.extensions.getExtension<CSharpExtensionExports>("ms-vscode.csharp");

    if (!csharpExtension.isActive) {
        await csharpExtension.activate();
    }

    try {
        await csharpExtension.exports.initializationFinished();
    }
    catch (err) {
        console.log(JSON.stringify(err));
    }
}
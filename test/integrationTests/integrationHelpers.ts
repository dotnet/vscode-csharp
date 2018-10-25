/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import CSharpExtensionExports from '../../src/CSharpExtensionExports';
import { Advisor } from '../../src/features/diagnosticsProvider';

export interface ActivationResult {
    readonly advisor: Advisor;
}

export async function activateCSharpExtension(): Promise<ActivationResult | undefined> {
    const csharpExtension = vscode.extensions.getExtension<CSharpExtensionExports>("ms-vscode.csharp");

    if (!csharpExtension.isActive) {
        await csharpExtension.activate();
    }

    try {
        await csharpExtension.exports.initializationFinished();
        console.log("ms-vscode.csharp activated");
        return { advisor: await csharpExtension.exports.getAdvisor() };
    }
    catch (err) {
        console.log(JSON.stringify(err));
        return undefined;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import CSharpExtensionExports from '../../src/CSharpExtensionExports';
import { Advisor } from '../../src/features/diagnosticsProvider';
import { EventStream } from '../../src/EventStream';

export interface ActivationResult {
    readonly advisor: Advisor;
    readonly eventStream: EventStream;
}

export async function activateCSharpExtension(): Promise<ActivationResult | undefined> {
    const csharpExtension = vscode.extensions.getExtension<CSharpExtensionExports>("ms-dotnettools.csharp");

    if (!csharpExtension.isActive) {
        await csharpExtension.activate();
    }

    try {
        await csharpExtension.exports.initializationFinished();
        console.log("ms-dotnettools.csharp activated");
        return {
            advisor: await csharpExtension.exports.getAdvisor(),
            eventStream: csharpExtension.exports.eventStream
        };
    }
    catch (err) {
        console.log(JSON.stringify(err));
        return undefined;
    }
}

export function isRazorWorkspace(workspace: typeof vscode.workspace) {
    const primeWorkspace = workspace.workspaceFolders[0];
    const projectFileName = primeWorkspace.uri.fsPath.split(path.sep).pop();

    return projectFileName === 'BasicRazorApp2_1';
}

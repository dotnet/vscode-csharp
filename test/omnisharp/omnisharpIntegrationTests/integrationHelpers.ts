/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { Advisor } from '../../../src/omnisharp/features/diagnosticsProvider';
import { EventStream } from '../../../src/eventStream';
import { EventType } from '../../../src/shared/eventType';
import { OmnisharpExtensionExports } from '../../../src/csharpExtensionExports';
import { describe } from '@jest/globals';

export interface ActivationResult {
    readonly advisor: Advisor;
    readonly eventStream: EventStream;
}

export async function activateCSharpExtension(): Promise<ActivationResult> {
    const configuration = vscode.workspace.getConfiguration();
    configuration.update(
        'omnisharp.enableLspDriver',
        process.env.OMNISHARP_DRIVER === 'lsp' ? true : false,
        vscode.ConfigurationTarget.WorkspaceFolder
    );
    if (process.env.OMNISHARP_LOCATION) {
        configuration.update('path', process.env.OMNISHARP_LOCATION, vscode.ConfigurationTarget.WorkspaceFolder);
    }

    const csharpExtension = vscode.extensions.getExtension<OmnisharpExtensionExports>('ms-dotnettools.csharp');
    if (!csharpExtension) {
        throw new Error('Failed to find installation of ms-dotnettools.csharp');
    }

    // Explicitly await the extension activation even if completed so that we capture any errors it threw during activation.
    await csharpExtension.activate();

    await csharpExtension.exports.initializationFinished();
    console.log('ms-dotnettools.csharp activated');

    // Output the directory where logs are being written so if a test fails we can match it to the right logs.
    console.log(`Extension log directory: ${csharpExtension.exports.logDirectory}`);

    const activationResult: ActivationResult = {
        advisor: await csharpExtension.exports.getAdvisor(),
        eventStream: csharpExtension.exports.eventStream,
    };

    return activationResult;
}

export async function restartOmniSharpServer(): Promise<void> {
    const csharpExtension = vscode.extensions.getExtension<OmnisharpExtensionExports>('ms-dotnettools.csharp');
    if (!csharpExtension) {
        throw new Error('Failed to find installation of ms-dotnettools.csharp');
    }

    if (!csharpExtension.isActive) {
        await activateCSharpExtension();
    }

    try {
        await new Promise<void>((resolve) => {
            const hook = csharpExtension.exports.eventStream.subscribe((event) => {
                if (event.type == EventType.OmnisharpStart) {
                    hook.unsubscribe();
                    resolve();
                }
            });
            vscode.commands.executeCommand('o.restart');
        });
        console.log('OmniSharp restarted');
    } catch (err) {
        console.log(JSON.stringify(err));
        throw err;
    }
}

export function isRazorWorkspace(workspace: typeof vscode.workspace) {
    return isGivenSln(workspace, 'BasicRazorApp2_1');
}

export function isSlnWithCsproj(workspace: typeof vscode.workspace) {
    return isGivenSln(workspace, 'slnWithCsproj');
}

export function isSlnWithGenerator(workspace: typeof vscode.workspace) {
    return isGivenSln(workspace, 'slnWithGenerator');
}

function isGivenSln(workspace: typeof vscode.workspace, expectedProjectFileName: string) {
    const primeWorkspace = workspace.workspaceFolders![0];
    const projectFileName = primeWorkspace.uri.fsPath.split(path.sep).pop();

    return projectFileName === expectedProjectFileName;
}

export const describeIfNotRazorOrGenerator = describeIf(
    !isRazorWorkspace(vscode.workspace) && !isSlnWithGenerator(vscode.workspace)
);

export const describeIfNotGenerator = describeIf(!isSlnWithGenerator(vscode.workspace));

export const describeIfGenerator = describeIf(isSlnWithGenerator(vscode.workspace));

export const describeIfSlnWithCsProj = describeIf(isSlnWithCsproj(vscode.workspace));

export const describeIfRazor = describeIf(isRazorWorkspace(vscode.workspace));

function describeIf(condition: boolean) {
    return condition ? describe : describe.skip;
}

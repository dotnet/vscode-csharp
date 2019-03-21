/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import CSharpExtensionExports from '../../src/CSharpExtensionExports';
import { Advisor } from '../../src/features/diagnosticsProvider';
import { EventStream } from '../../src/EventStream';

export interface ActivationResult {
    readonly advisor: Advisor;
    readonly eventStream: EventStream;
}

export async function activateCSharpExtension(): Promise<ActivationResult | undefined> {
    const csharpExtension = vscode.extensions.getExtension<CSharpExtensionExports>("ms-vscode.csharp");

    if (!csharpExtension.isActive) {
        await csharpExtension.activate();
    }

    try {
        await csharpExtension.exports.initializationFinished();
        console.log("ms-vscode.csharp activated");
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

export async function pollUntil(fn: () => boolean, timeoutMs: number) {
    const pollInterval = 50;
    let timeWaited = 0;
    while (!fn()) {
        if (timeWaited >= timeoutMs) {
            throw new Error(`Timed out after ${timeoutMs}ms.`);
        }

        await new Promise(r => setTimeout(r, pollInterval));
        timeWaited += pollInterval;
    }
}

// In tests when we edit a document if our test expects to evaluate the output of that document
// after an edit then we'll need to wait for all those edits to flush through the system. Otherwise
// the edits remain in a cached version of the document resulting in our calls to `getText` failing.
export async function waitForDocumentUpdate(
    documentUri: vscode.Uri,
    isUpdated: (document: vscode.TextDocument) => boolean) {
    const updatedDocument = await vscode.workspace.openTextDocument(documentUri);
    let updateError: any;
    let documentUpdated = false;
    const checkUpdated = (document: vscode.TextDocument) => {
        try {
            documentUpdated = isUpdated(document);
        } catch (error) {
            updateError = error;
        }
    };

    checkUpdated(updatedDocument);

    const registration = vscode.workspace.onDidChangeTextDocument(args => {
        if (documentUri === args.document.uri) {
            checkUpdated(args.document);
        }
    });

    try {
        await pollUntil(() => updateError !== undefined || documentUpdated === true, 3000);
    } finally {
        registration.dispose();
    }

    if (updateError) {
        throw updateError;
    }

    return updatedDocument;
}

export async function extensionActivated<T>(identifier: string) {
    const extension = vscode.extensions.getExtension<T>(identifier);

    if (!extension) {
        throw new Error(`Could not find extension '${identifier}'`);
    }

    if (!extension.isActive) {
        await extension.activate();
    }

    return extension;
}


export async function htmlLanguageFeaturesExtensionReady() {
    await extensionActivated<any>('vscode.html-language-features');
}

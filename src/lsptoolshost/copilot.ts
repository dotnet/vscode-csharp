/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CSharpExtensionId } from '../constants/csharpExtensionId';
import { CopilotRelatedDocumentsReport, CopilotRelatedDocumentsRequest } from './roslynProtocol';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { UriConverter } from './uriConverter';
import { TextDocumentIdentifier } from 'vscode-languageserver-protocol';

interface CopilotRelatedFilesProviderRegistration {
    registerRelatedFilesProvider(
        providerId: { extensionId: string; languageId: string },
        callback: (uri: vscode.Uri) => Promise<{ entries: vscode.Uri[]; traits?: { name: string; value: string }[] }>
    ): void;
}

export async function registerCopilotExtensionAsync(
    languageServer: RoslynLanguageServer,
    tracingChannel: vscode.OutputChannel
) {
    const ext = vscode.extensions.getExtension('github.copilot');
    if (!ext) {
        tracingChannel.appendLine(
            'GitHub Copilot extension not installed. Skip registeration of C# related files provider.'
        );
        return;
    }
    await ext.activate();
    const relatedAPI = ext.exports as CopilotRelatedFilesProviderRegistration | undefined;
    if (!relatedAPI) {
        tracingChannel.appendLine(
            'Incompatible GitHub Copilot extension installed. Skip registeration of C# related files provider.'
        );
        return;
    }
    tracingChannel.appendLine('registeration of C# related files provider for GitHub Copilot extension succeeded.');

    const id = {
        extensionId: CSharpExtensionId,
        languageId: 'csharp',
    };

    relatedAPI.registerRelatedFilesProvider(id, async (uri) => {
        const buildResult = (reports: CopilotRelatedDocumentsReport[], builder?: vscode.Uri[]) => {
            if (reports) {
                for (const report of reports) {
                    if (report._vs_file_paths) {
                        for (const filePath of report._vs_file_paths) {
                            builder?.push(vscode.Uri.file(filePath));
                        }
                    }
                }
            }
        };
        const relatedFiles: vscode.Uri[] = [];
        const uriString = UriConverter.serialize(uri);
        const textDocument = TextDocumentIdentifier.create(uriString);
        const responsePromise = languageServer.sendRequestWithProgress(
            CopilotRelatedDocumentsRequest.type,
            {
                _vs_textDocument: textDocument,
                position: {
                    line: 0,
                    character: 0,
                },
            },
            async (r) => buildResult(r, relatedFiles)
        );

        try {
            await responsePromise;
        } catch (e) {
            if (e instanceof Error) {
                tracingChannel.appendLine(e.message);
            }
        }
        return { entries: relatedFiles };
    });
}

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

interface CopilotTrait {
    name: string;
    value: string;
    includeInPrompt?: boolean;
    promptTextOverride?: string;
}

interface CopilotRelatedFilesProviderRegistration {
    registerRelatedFilesProvider(
        providerId: { extensionId: string; languageId: string },
        callback: (
            uri: vscode.Uri,
            context: { flags: Record<string, unknown> },
            cancellationToken?: vscode.CancellationToken
        ) => Promise<{ entries: vscode.Uri[]; traits?: CopilotTrait[] }>
    ): vscode.Disposable;
}

export function registerCopilotExtension(languageServer: RoslynLanguageServer, channel: vscode.LogOutputChannel) {
    const ext = vscode.extensions.getExtension('github.copilot');
    if (!ext) {
        channel.debug('GitHub Copilot extension not installed. Skip registeration of C# related files provider.');
        return;
    }
    ext.activate().then(() => {
        const relatedAPI = ext.exports as CopilotRelatedFilesProviderRegistration | undefined;
        if (!relatedAPI) {
            channel.debug(
                'Incompatible GitHub Copilot extension installed. Skip registeration of C# related files provider.'
            );
            return;
        }

        channel.debug('registration of C# related files provider for GitHub Copilot extension succeeded.');

        const id = {
            extensionId: CSharpExtensionId,
            languageId: 'csharp',
        };

        relatedAPI.registerRelatedFilesProvider(id, async (uri, _, token) => {
            const buildResult = (
                activeDocumentUri: vscode.Uri,
                reports: CopilotRelatedDocumentsReport[],
                builder: vscode.Uri[]
            ) => {
                if (reports) {
                    for (const report of reports) {
                        if (report._vs_file_paths) {
                            for (const filePath of report._vs_file_paths) {
                                // The Roslyn related document service would return the active document as related file to itself
                                // if the code contains reference to the types defined in the same document. Skip it so the active file
                                // won't be used as additonal context.
                                const relatedUri = vscode.Uri.file(filePath);
                                if (relatedUri.fsPath !== activeDocumentUri.fsPath) {
                                    builder.push(relatedUri);
                                }
                            }
                        }
                    }
                }
            };
            const relatedFiles: vscode.Uri[] = [];
            const uriString = UriConverter.serialize(uri);
            const textDocument = TextDocumentIdentifier.create(uriString);
            try {
                await languageServer.sendRequestWithProgress(
                    CopilotRelatedDocumentsRequest.type,
                    {
                        _vs_textDocument: textDocument,
                        position: {
                            line: 0,
                            character: 0,
                        },
                    },
                    async (r) => buildResult(uri, r, relatedFiles),
                    token
                );
            } catch (e) {
                if (e instanceof Error) {
                    channel.appendLine(e.message);
                }
            }
            return { entries: relatedFiles };
        });
    });
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CSharpExtensionId } from '../../constants/csharpExtensionId';
import { CopilotRelatedDocumentsReport, CopilotRelatedDocumentsRequest } from '../server/roslynProtocol';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { UriConverter } from '../utils/uriConverter';
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

export function registerCopilotRelatedFilesProvider(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    channel: vscode.LogOutputChannel
) {
    const copilotApi = vscode.extensions.getExtension<CopilotRelatedFilesProviderRegistration>('github.copilot');
    if (!copilotApi) {
        channel.debug(
            'Failed to find comnpatible version of GitHub Copilot extension installed. Skip registeration of Copilot related files provider.'
        );
        return;
    }

    copilotApi.activate().then(async (api) => {
        try {
            const id = {
                extensionId: CSharpExtensionId,
                languageId: 'csharp',
            };

            context.subscriptions.push(
                api.registerRelatedFilesProvider(id, async (uri, _, token) => {
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
                    channel.trace(`Copilot related files provider returned ${relatedFiles.length} items`);
                    return { entries: relatedFiles };
                })
            );

            channel.debug('Registration of C# related files provider for GitHub Copilot extension succeeded.');
        } catch (error) {
            channel.error('Failed to register Copilot related files providers', error);
        }
    });
}

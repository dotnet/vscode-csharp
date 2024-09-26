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
import { languageServerOptions } from '../shared/options';

interface CopilotRelatedFilesProviderRegistration {
    registerRelatedFilesProvider(
        providerId: { extensionId: string; languageId: string },
        callback: (
            uri: vscode.Uri,
            cancellationToken: vscode.CancellationToken
        ) => Promise<{ entries: vscode.Uri[]; traits?: { name: string; value: string }[] }>
    ): vscode.Disposable;
}

export function registerCopilotExtension(
    languageServer: RoslynLanguageServer,
    channel: vscode.OutputChannel
) {
    const isTraceLogLevel =
        languageServerOptions.logLevel &&
        (languageServerOptions.logLevel === 'Trace' || languageServerOptions.logLevel === 'Debug');

    const ext = vscode.extensions.getExtension('github.copilot');
    if (!ext) {
        if (isTraceLogLevel) {
            channel.appendLine(
                'GitHub Copilot extension not installed. Skip registeration of C# related files provider.'
            );
        }
        return;
    }
    ext.activate().then(() => {
        const relatedAPI = ext.exports as CopilotRelatedFilesProviderRegistration | undefined;
        if (!relatedAPI) {
            if (isTraceLogLevel) {
                channel.appendLine(
                    'Incompatible GitHub Copilot extension installed. Skip registeration of C# related files provider.'
                );
            }
            return;
        }

        if (isTraceLogLevel) {
            channel.appendLine('registeration of C# related files provider for GitHub Copilot extension succeeded.');
        }

        const id = {
            extensionId: CSharpExtensionId,
            languageId: 'csharp',
        };

        relatedAPI.registerRelatedFilesProvider(id, async (uri, token) => {
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
                    async (r) => buildResult(r, relatedFiles),
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

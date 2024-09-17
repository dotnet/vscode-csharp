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

export async function registerCopilotExtension(languageServer: RoslynLanguageServer, channel: vscode.OutputChannel) {
    const ext = vscode.extensions.getExtension('github.copilot');
    if (!ext) {
        channel.appendLine('GitHub Copilot extension not installed. Skipping call to `registerRelatedFilesProvider`');
        return;
    }
    await ext.activate();
    const relatedAPI = ext.exports as
        | {
              registerRelatedFilesProvider(
                  providerId: { extensionId: string; languageId: string },
                  callback: (
                      uri: vscode.Uri
                  ) => Promise<{ entries: vscode.Uri[]; traits?: { name: string; value: string }[] }>
              ): void;
          }
        | undefined;
    if (!relatedAPI) {
        channel.appendLine(
            'Incompatible GitHub Copilot extension installed. Skipping call to `registerRelatedFilesProvider`'
        );
        return;
    }
    channel.appendLine('registerRelatedFilesProvider succeeded.');

    const id = {
        extensionId: CSharpExtensionId,
        languageId: 'csharp',
    };

    relatedAPI.registerRelatedFilesProvider(id, async (uri) => {
        const writeOutput = (output: CopilotRelatedDocumentsReport[], builder: vscode.Uri[] | null) => {
            if (output) {
                for (const report of output) {
                    if (report._vs_file_paths) {
                        for (const filePath of report._vs_file_paths) {
                            channel.appendLine('found related file: ' + filePath);
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
            async (p) => {
                writeOutput(p, relatedFiles);
            }
        );

        await responsePromise.then(
            (result) => {
                writeOutput(result, null);
                return;
            },
            (err) => {
                channel.appendLine(err);
                return;
            }
        );

        return {
            entries: relatedFiles,
        };
    });
}

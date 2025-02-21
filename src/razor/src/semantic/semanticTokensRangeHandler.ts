/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-jsonrpc';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { ProvideSemanticTokensResponse } from './provideSemanticTokensResponse';
import { SerializableSemanticTokensParams } from './serializableSemanticTokensParams';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { RazorDocumentSynchronizer } from '../document/razorDocumentSynchronizer';
import { RazorLogger } from '../razorLogger';

export class SemanticTokensRangeHandler {
    private static readonly getSemanticTokensRangeEndpoint = 'razor/provideSemanticTokensRange';
    private semanticTokensRequestType: RequestType<
        SerializableSemanticTokensParams,
        ProvideSemanticTokensResponse,
        any
    > = new RequestType(SemanticTokensRangeHandler.getSemanticTokensRangeEndpoint);
    private emptyTokensResponse: number[] = new Array<number>();

    constructor(
        private readonly documentManager: RazorDocumentManager,
        private readonly documentSynchronizer: RazorDocumentSynchronizer,
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger
    ) {}

    public async register() {
        await this.serverClient.onRequestWithParams<
            SerializableSemanticTokensParams,
            ProvideSemanticTokensResponse,
            any
        >(
            this.semanticTokensRequestType,
            async (request: SerializableSemanticTokensParams, token: vscode.CancellationToken) =>
                this.getSemanticTokens(request, token)
        );
    }

    private async getSemanticTokens(
        semanticTokensParams: SerializableSemanticTokensParams,
        cancellationToken: vscode.CancellationToken
    ): Promise<ProvideSemanticTokensResponse> {
        try {
            const razorDocumentUri = vscode.Uri.parse(semanticTokensParams.textDocument.uri, true);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                this.logger.logWarning(
                    `Could not find Razor document ${razorDocumentUri}; returning semantic tokens information.`
                );

                return new ProvideSemanticTokensResponse(
                    this.emptyTokensResponse,
                    semanticTokensParams.requiredHostDocumentVersion
                );
            }

            const textDocument = await vscode.workspace.openTextDocument(razorDocumentUri);
            const synchronized = await this.documentSynchronizer.trySynchronizeProjectedDocument(
                textDocument,
                razorDocument.csharpDocument,
                semanticTokensParams.requiredHostDocumentVersion,
                cancellationToken
            );

            if (!synchronized) {
                return new ProvideSemanticTokensResponse(
                    this.emptyTokensResponse,
                    semanticTokensParams.requiredHostDocumentVersion
                );
            }

            if (semanticTokensParams.requiredHostDocumentVersion == 1) {
                // HACK: Workaround for https://github.com/dotnet/razor/issues/9197 to stop errors from being thrown.
                // Sometimes we get asked for semantic tokens on v1, and we have sent a v1 to Roslyn, but its the wrong v1.
                // To prevent Roslyn throwing, lets validate the range we're asking about with the generated document they
                // would have seen.
                const endLine = semanticTokensParams.ranges[0].end.line;
                const lineCount = this.countLines(razorDocument.csharpDocument.getContent());

                if (lineCount < endLine) {
                    return new ProvideSemanticTokensResponse(this.emptyTokensResponse, -1);
                }
            }

            const tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
                'vscode.provideDocumentRangeSemanticTokens',
                razorDocument.csharpDocument.uri,
                semanticTokensParams.ranges[0]
            );

            return new ProvideSemanticTokensResponse(
                Array.from(tokens.data),
                semanticTokensParams.requiredHostDocumentVersion
            );
        } catch (error) {
            this.logger.logWarning(`${SemanticTokensRangeHandler.getSemanticTokensRangeEndpoint} failed with ${error}`);
        }

        return new ProvideSemanticTokensResponse(
            this.emptyTokensResponse,
            semanticTokensParams.requiredHostDocumentVersion
        );
    }

    private countLines(text: string) {
        let lineCount = 0;
        for (const i of text) {
            if (i === '\n') {
                lineCount++;
            }
        }

        return lineCount;
    }
}

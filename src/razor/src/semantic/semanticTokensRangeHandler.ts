/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-languageclient';
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
}

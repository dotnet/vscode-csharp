/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-languageclient';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { ProvideSemanticTokensResponse } from './provideSemanticTokensResponse';
import { SerializableSemanticTokensParams } from './serializableSemanticTokensParams';
import { RazorDocumentSynchronizer } from '../document/razorDocumentSynchronizer';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { RazorLanguageServiceClient } from '../razorLanguageServiceClient';
import { RazorLogger } from '../razorLogger';

export class SemanticTokensRangeHandler {
    private static readonly getSemanticTokensRangeEndpoint = 'razor/provideSemanticTokensRange';
    private semanticTokensRequestType: RequestType<
        SerializableSemanticTokensParams,
        ProvideSemanticTokensResponse,
        any
    > = new RequestType(SemanticTokensRangeHandler.getSemanticTokensRangeEndpoint);
    private emptySemanticTokensResponse: ProvideSemanticTokensResponse = new ProvideSemanticTokensResponse(
        new Array<Array<number>>(),
        -1
    );

    constructor(
        private readonly documentSynchronizer: RazorDocumentSynchronizer,
        protected readonly serverClient: RazorLanguageServerClient,
        protected readonly serviceClient: RazorLanguageServiceClient,
        protected readonly documentManager: RazorDocumentManager,
        protected readonly logger: RazorLogger
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
        _semanticTokensParams: SerializableSemanticTokensParams,
        _cancellationToken: vscode.CancellationToken
    ): Promise<ProvideSemanticTokensResponse> {
        let version = -1;
        try {
            const razorDocumentUri = vscode.Uri.parse(_semanticTokensParams.textDocument.uri);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                return this.emptySemanticTokensResponse;
            }

            const textDocument = await vscode.workspace.openTextDocument(razorDocumentUri);
            version = textDocument.version;
            const synchronized = await this.documentSynchronizer.trySynchronizeProjectedDocument(
                textDocument,
                razorDocument.csharpDocument,
                version,
                _cancellationToken
            );
            if (!synchronized) {
                return this.emptySemanticTokensResponse;
            }
        } catch (error) {
            this.logger.logWarning(`${SemanticTokensRangeHandler.getSemanticTokensRangeEndpoint} failed with ${error}`);
        }

        // This is currently a no-op since (1) the default C# semantic tokens experience is already powerful and
        // (2) there seems to be an issue with the semantic tokens execute command - possibly either O# not
        // returning tokens, or an issue with the command itself:
        // https://github.com/dotnet/razor/issues/6922
        return new ProvideSemanticTokensResponse(new Array<Array<number>>(), version);
    }
}

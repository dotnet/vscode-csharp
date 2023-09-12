/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-languageclient';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { ProvideSemanticTokensResponse } from './provideSemanticTokensResponse';
import { SerializableSemanticTokensParams } from './serializableSemanticTokensParams';

export class SemanticTokensRangeHandler {
    private static readonly getSemanticTokensRangeEndpoint = 'razor/provideSemanticTokensRange';
    private semanticTokensRequestType: RequestType<
        SerializableSemanticTokensParams,
        ProvideSemanticTokensResponse,
        any
    > = new RequestType(SemanticTokensRangeHandler.getSemanticTokensRangeEndpoint);
    private emptyTokensInResponse: Array<Array<number>> = new Array<Array<number>>();

    constructor(private readonly serverClient: RazorLanguageServerClient) {}

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
        // This is currently a no-op since (1) the default C# semantic tokens experience is already powerful and
        // (2) there seems to be an issue with the semantic tokens execute command - possibly either O# not
        // returning tokens, or an issue with the command itself:
        // https://github.com/dotnet/razor/issues/6922
        return new ProvideSemanticTokensResponse(
            this.emptyTokensInResponse,
            _semanticTokensParams.requiredHostDocumentVersion
        );
    }
}

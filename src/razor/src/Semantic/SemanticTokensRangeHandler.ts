/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-languageclient';
import { RazorLanguageServerClient } from '../RazorLanguageServerClient';
import { ProvideSemanticTokensResponse } from './ProvideSemanticTokensResponse';
import { SemanticTokensResponse } from './SemanticTokensResponse';
import { SerializableSemanticTokensParams } from './SerializableSemanticTokensParams';

export class SemanticTokensRangeHandler {
    private static readonly getSemanticTokensRangeEndpoint = 'razor/provideSemanticTokensRange';
    private semanticTokensRequestType: RequestType<SerializableSemanticTokensParams, ProvideSemanticTokensResponse, any> =
        new RequestType(SemanticTokensRangeHandler.getSemanticTokensRangeEndpoint);
    private emptySemanticTokensResponse: ProvideSemanticTokensResponse = new ProvideSemanticTokensResponse(
        new SemanticTokensResponse(new Array<number>(), ''),
        null);

    constructor(private readonly serverClient: RazorLanguageServerClient) { }

    public register() {
        // tslint:disable-next-line: no-floating-promises
        this.serverClient.onRequestWithParams<SerializableSemanticTokensParams, ProvideSemanticTokensResponse, any>(
            this.semanticTokensRequestType,
            async (request: SerializableSemanticTokensParams, token: vscode.CancellationToken) => this.getSemanticTokens(request, token));
    }

    private async getSemanticTokens(
        semanticTokensParams: SerializableSemanticTokensParams,
        cancellationToken: vscode.CancellationToken): Promise<ProvideSemanticTokensResponse> {

        // This is currently a no-op since (1) the default C# semantic tokens experience is already powerful and
        // (2) there seems to be an issue with the semantic tokens execute command - possibly either O# not
        // returning tokens, or an issue with the command itself:
        // https://github.com/dotnet/razor-tooling/issues/6922
        return this.emptySemanticTokensResponse;
    }
}

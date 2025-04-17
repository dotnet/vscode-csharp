/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TextDocumentIdentifier } from 'vscode-languageserver-types';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { razorTextSpan } from '../dynamicFile/razorTextSpan';
import * as vscode from 'vscode';
import { RequestType } from 'vscode-jsonrpc';
import { RazorLogger } from '../razorLogger';
import { LanguageKind } from '../rpc/languageKind';
import { razorTextChange } from '../dynamicFile/razorTextChange';
import { MappingBehavior } from '../rpc/mappingBehavior';
import { UriConverter } from '../../../lsptoolshost/utils/uriConverter';
import { RazorMapToDocumentRangesResponse } from '../rpc/razorMapToDocumentRangesResponse';
import { RazorMapToDocumentEditsParams } from '../rpc/razorMapToDocumentEditsParams';
import { RazorMapToDocumentEditsResponse } from '../rpc/razorMapToDocumentEditsResponse';
import { RazorMapToDocumentRangesRequest } from '../rpc/razorMapToDocumentRangesRequest';

export class MapSpanHandler {
    private static readonly mapSpansEndpoint = 'razor/mapSpans';
    private static readonly mapTextChangesEndpoint = 'razor/mapTextChanges';

    private mapSpansRequestType: RequestType<MapSpanParams, MapSpansResponse, any> = new RequestType(
        MapSpanHandler.mapSpansEndpoint
    );

    private mapTextChangesRequestType: RequestType<MapChangesParams, MapChangesResponse, any> = new RequestType(
        MapSpanHandler.mapTextChangesEndpoint
    );

    constructor(
        private readonly documentManager: RazorDocumentManager,
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger
    ) {}

    public async register() {
        await this.serverClient.onRequestWithParams<MapSpanParams, MapSpansResponse | null, any>(
            this.mapSpansRequestType,
            async (request: MapSpanParams, token: vscode.CancellationToken) => this.mapSpans(request, token)
        );

        await this.serverClient.onRequestWithParams<MapChangesParams, MapChangesResponse | null, any>(
            this.mapTextChangesRequestType,
            async (request: MapChangesParams, token: vscode.CancellationToken) => this.mapEdits(request, token)
        );
    }
    private async mapEdits(params: MapChangesParams, _: vscode.CancellationToken): Promise<MapChangesResponse | null> {
        try {
            const csharpDocumentUri = vscode.Uri.parse(params.csharpDocument.uri);
            const document = await this.documentManager.tryGetDOcumentFromCsharp(csharpDocumentUri);
            if (document === null) {
                this.logger.logWarning(
                    `${MapSpanHandler.mapSpansEndpoint} failed to find razor document for ${csharpDocumentUri}`
                );

                return null;
            }

            const razorUri = document.uri;
            const request: RazorMapToDocumentEditsParams = {
                kind: LanguageKind.CSharp,
                razorDocumentUri: razorUri,
                textChanges: params.textChanges,
            };

            const response = await this.serverClient.sendRequest<RazorMapToDocumentEditsResponse>('', request);
            if (!response) {
                return null;
            }

            return {
                razorDocument: { uri: razorUri.fsPath },
                mappedTextChanges: response.textChanges,
            };
        } catch (error) {
            this.logger.logWarning(`${MapSpanHandler.mapSpansEndpoint} failed with ${error}`);
        }

        return null;
    }
    private async mapSpans(request: MapSpanParams, _: vscode.CancellationToken): Promise<MapSpansResponse | null> {
        try {
            const csharpDocumentUri = vscode.Uri.parse(request.csharpDocument.uri);
            const document = await this.documentManager.tryGetDOcumentFromCsharp(csharpDocumentUri);
            if (document === null) {
                this.logger.logWarning(
                    `${MapSpanHandler.mapSpansEndpoint} failed to find razor document for ${csharpDocumentUri}`
                );

                return null;
            }

            const razorUri = document.uri;
            const params = new RazorMapToDocumentRangesRequest(
                LanguageKind.CSharp,
                request.ranges,
                razorUri,
                MappingBehavior.Strict
            );

            const response = await this.serverClient.sendRequest<RazorMapToDocumentRangesResponse>(
                'razor/mapToDocumentRanges',
                params
            );

            return {
                razorDocument: TextDocumentIdentifier.create(UriConverter.serialize(razorUri)),
                mappedRanges: response.ranges,
                mappedSpans: response.spans,
            };
        } catch (error) {
            this.logger.logWarning(`${MapSpanHandler.mapSpansEndpoint} failed with ${error}`);
        }

        return null;
    }
}

interface MapSpanParams {
    csharpDocument: TextDocumentIdentifier;
    ranges: vscode.Range[];
}

interface MapSpansResponse {
    razorDocument: TextDocumentIdentifier;
    mappedSpans: razorTextSpan[];
    mappedRanges: vscode.Range[];
}

interface MapChangesParams {
    csharpDocument: TextDocumentIdentifier;
    textChanges: razorTextChange[];
}

interface MapChangesResponse {
    razorDocument: TextDocumentIdentifier;
    mappedTextChanges: razorTextChange[];
}

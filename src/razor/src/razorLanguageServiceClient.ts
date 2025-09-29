/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RazorLanguageServerClient } from './razorLanguageServerClient';
import { LanguageKind } from './rpc/languageKind';
import { LanguageQueryRequest } from './rpc/languageQueryRequest';
import { LanguageQueryResponse } from './rpc/languageQueryResponse';
import { RazorMapToDocumentRangesRequest } from './rpc/razorMapToDocumentRangesRequest';
import { RazorMapToDocumentRangesResponse } from './rpc/razorMapToDocumentRangesResponse';
import { convertRangeFromSerializable, convertRangeToSerializable } from './rpc/serializableRange';
import { RazorMapSpansParams } from './mapping/razorMapSpansParams';
import { RazorMapSpansResponse } from './mapping/razorMapSpansResponse';
import { UriConverter } from '../../lsptoolshost/utils/uriConverter';
import { RazorDocumentManager } from './document/razorDocumentManager';
import { RazorMapTextChangesParams } from './mapping/razorMapTextChangesParams';
import { RazorMapTextChangesResponse } from './mapping/razorMapTextChangesResponse';
import { RazorMapToDocumentEditsParams } from './mapping/razorMapToDocumentEditsParams';
import { RazorMapToDocumentEditsResponse } from './mapping/razorMapToDocumentEditsResponse';

export class RazorLanguageServiceClient {
    constructor(
        private readonly serverClient: RazorLanguageServerClient,
        private readonly documentManager: RazorDocumentManager
    ) {}

    private static readonly MapToDocumentRangesEndpoint = 'razor/mapToDocumentRanges';

    public async languageQuery(position: vscode.Position, uri: vscode.Uri) {
        await this.ensureStarted();

        const request = new LanguageQueryRequest(position, uri);
        const response = await this.serverClient.sendRequest<LanguageQueryResponse>('razor/languageQuery', request);
        response.position = new vscode.Position(response.position.line, response.position.character);
        return response;
    }

    public async mapToDocumentRanges(languageKind: LanguageKind, ranges: vscode.Range[], uri: vscode.Uri) {
        await this.ensureStarted();

        const serializableRanges = [];
        for (const range of ranges) {
            const serializableRange = convertRangeToSerializable(range);
            serializableRanges.push(serializableRange);
        }

        const request = new RazorMapToDocumentRangesRequest(languageKind, serializableRanges, uri);
        const response = await this.serverClient.sendRequest<RazorMapToDocumentRangesResponse>(
            RazorLanguageServiceClient.MapToDocumentRangesEndpoint,
            request
        );
        const responseRanges = [];
        for (const range of response.ranges) {
            if (range.start.line >= 0) {
                const remappedRange = convertRangeFromSerializable(response.ranges[0]);
                responseRanges.push(remappedRange);
            }
        }

        response.ranges = responseRanges;
        return response;
    }

    public async mapSpans(params: RazorMapSpansParams): Promise<RazorMapSpansResponse> {
        const csharpUri = UriConverter.deserialize(params.csharpDocument.uri);
        const document = await this.documentManager.getDocumentForCSharpUri(csharpUri);

        if (!document) {
            return RazorMapSpansResponse.empty;
        }

        const request = new RazorMapToDocumentRangesRequest(LanguageKind.CSharp, params.ranges, document.uri);
        const result = await this.serverClient.sendRequest<RazorMapToDocumentRangesResponse>(
            RazorLanguageServiceClient.MapToDocumentRangesEndpoint,
            request
        );

        if (!result) {
            return RazorMapSpansResponse.empty;
        }

        return new RazorMapSpansResponse(
            result.ranges.map((r) => {
                return {
                    start: { line: r.start.line, character: r.start.character },
                    end: { line: r.end.line, character: r.end.character },
                };
            }),
            result.spans,
            {
                uri: UriConverter.serialize(document.uri),
            }
        );
    }

    async mapTextChanges(params: RazorMapTextChangesParams): Promise<RazorMapTextChangesResponse> {
        const csharpUri = UriConverter.deserialize(params.csharpDocument.uri);
        const document = await this.documentManager.getDocumentForCSharpUri(csharpUri);
        if (!document) {
            return RazorMapTextChangesResponse.empty;
        }

        const request = new RazorMapToDocumentEditsParams(LanguageKind.CSharp, document.uri, params.textChanges);
        const response = await this.serverClient.sendRequest<RazorMapToDocumentEditsResponse>(
            'razor/mapToDocumentEdits',
            request
        );

        if (!response) {
            return RazorMapTextChangesResponse.empty;
        }

        return new RazorMapTextChangesResponse(
            {
                uri: UriConverter.serialize(document.uri),
            },
            response.textChanges
        );
    }

    private async ensureStarted() {
        // If the server is already started this will instantly return.
        await this.serverClient.start();
    }
}

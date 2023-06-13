/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { RazorLanguageServerClient } from './RazorLanguageServerClient';
import { LanguageKind } from './RPC/LanguageKind';
import { LanguageQueryRequest } from './RPC/LanguageQueryRequest';
import { LanguageQueryResponse } from './RPC/LanguageQueryResponse';
import { RazorMapToDocumentRangesRequest } from './RPC/RazorMapToDocumentRangesRequest';
import { RazorMapToDocumentRangesResponse } from './RPC/RazorMapToDocumentRangesResponse';
import { convertRangeFromSerializable, convertRangeToSerializable } from './RPC/SerializableRange';

export class RazorLanguageServiceClient {
    constructor(private readonly serverClient: RazorLanguageServerClient) {
    }

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
        const response = await this.serverClient.sendRequest<RazorMapToDocumentRangesResponse>('razor/mapToDocumentRanges', request);
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

    private async ensureStarted() {
        // If the server is already started this will instantly return.
        await this.serverClient.start();
    }
}

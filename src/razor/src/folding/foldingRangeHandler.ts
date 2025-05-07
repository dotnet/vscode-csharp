/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { FoldingRange, FoldingRangeKind, RequestType } from 'vscode-languageserver-protocol';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { RazorLogger } from '../razorLogger';
import { SerializableFoldingRangeParams } from './serializableFoldingRangeParams';
import { SerializableFoldingRangeResponse } from './serializableFoldingRangeResponse';

export class FoldingRangeHandler {
    private static readonly provideFoldingRange = 'razor/foldingRange';
    private foldingRangeRequestType: RequestType<
        SerializableFoldingRangeParams,
        SerializableFoldingRangeResponse,
        any
    > = new RequestType(FoldingRangeHandler.provideFoldingRange);
    private emptyFoldingRangeReponse: SerializableFoldingRangeResponse = new SerializableFoldingRangeResponse(
        new Array<FoldingRange>(),
        new Array<FoldingRange>()
    );

    constructor(
        private readonly serverClient: RazorLanguageServerClient,
        private readonly documentManager: RazorDocumentManager,
        private readonly logger: RazorLogger
    ) {}

    public async register() {
        await this.serverClient.onRequestWithParams<
            SerializableFoldingRangeParams,
            SerializableFoldingRangeResponse,
            any
        >(this.foldingRangeRequestType, async (request, token) => this.provideFoldingRanges(request, token));
    }

    private async provideFoldingRanges(
        foldingRangeParams: SerializableFoldingRangeParams,
        _: vscode.CancellationToken
    ) {
        try {
            const razorDocumentUri = vscode.Uri.parse(foldingRangeParams.textDocument.uri, true);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                return this.emptyFoldingRangeReponse;
            }

            const virtualHtmlUri = razorDocument.htmlDocument.uri;
            const virtualCSharpUri = razorDocument.csharpDocument.uri;

            const htmlFoldingRanges = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
                'vscode.executeFoldingRangeProvider',
                virtualHtmlUri
            );
            const csharpFoldingRanges = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
                'vscode.executeFoldingRangeProvider',
                virtualCSharpUri
            );

            const convertedHtmlFoldingRanges =
                htmlFoldingRanges === undefined
                    ? new Array<FoldingRange>()
                    : FoldingRangeHandler.convertFoldingRanges(htmlFoldingRanges, this.logger);
            const convertedCSharpFoldingRanges =
                csharpFoldingRanges === undefined
                    ? new Array<FoldingRange>()
                    : FoldingRangeHandler.convertFoldingRanges(csharpFoldingRanges, this.logger);

            const response = new SerializableFoldingRangeResponse(
                convertedHtmlFoldingRanges,
                convertedCSharpFoldingRanges
            );
            return response;
        } catch (error) {
            this.logger.logWarning(`${FoldingRangeHandler.provideFoldingRange} failed with ${error}`);
        }

        return this.emptyFoldingRangeReponse;
    }

    public static convertFoldingRanges(foldingRanges: vscode.FoldingRange[], logger: RazorLogger) {
        const convertedFoldingRanges = new Array<FoldingRange>();
        foldingRanges.forEach((foldingRange) => {
            const convertedFoldingRange: FoldingRange = {
                startLine: foldingRange.start,
                startCharacter: 0,
                endLine: foldingRange.end,
                endCharacter: 0,
                kind:
                    foldingRange.kind === undefined
                        ? undefined
                        : FoldingRangeHandler.convertFoldingRangeKind(foldingRange.kind, logger),
            };

            convertedFoldingRanges.push(convertedFoldingRange);
        });

        return convertedFoldingRanges;
    }

    private static convertFoldingRangeKind(kind: vscode.FoldingRangeKind, logger: RazorLogger) {
        if (kind === vscode.FoldingRangeKind.Comment) {
            return FoldingRangeKind.Comment;
        } else if (kind === vscode.FoldingRangeKind.Imports) {
            return FoldingRangeKind.Imports;
        } else if (kind === vscode.FoldingRangeKind.Region) {
            return FoldingRangeKind.Region;
        } else {
            logger.logWarning(`Unexpected FoldingRangeKind ${kind}`);
            return undefined;
        }
    }
}

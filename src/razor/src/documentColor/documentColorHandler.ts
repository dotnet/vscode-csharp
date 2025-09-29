/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-jsonrpc';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { RazorLogger } from '../razorLogger';
import { convertRangeToSerializable } from '../rpc/serializableRange';
import { SerializableColorInformation } from './serializableColorInformation';
import { SerializableDocumentColorParams } from './serializableDocumentColorParams';
import { RazorDocumentSynchronizer } from '../document/razorDocumentSynchronizer';

export class DocumentColorHandler {
    private static readonly provideHtmlDocumentColorEndpoint = 'razor/provideHtmlDocumentColor';
    private documentColorRequestType: RequestType<
        SerializableDocumentColorParams,
        SerializableColorInformation[],
        any
    > = new RequestType(DocumentColorHandler.provideHtmlDocumentColorEndpoint);
    private emptyColorInformationResponse: SerializableColorInformation[] = [];

    constructor(
        private readonly documentManager: RazorDocumentManager,
        private readonly documentSynchronizer: RazorDocumentSynchronizer,
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger
    ) {}

    public async register() {
        await this.serverClient.onRequestWithParams<
            SerializableDocumentColorParams,
            SerializableColorInformation[],
            any
        >(
            this.documentColorRequestType,
            async (request: SerializableDocumentColorParams, token: vscode.CancellationToken) =>
                this.provideHtmlDocumentColors(request, token)
        );
    }

    private async provideHtmlDocumentColors(
        documentColorParams: SerializableDocumentColorParams,
        cancellationToken: vscode.CancellationToken
    ) {
        try {
            const razorDocumentUri = vscode.Uri.parse(documentColorParams.textDocument.uri, true);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                this.logger.logWarning(
                    `Could not find Razor document ${razorDocumentUri}; returning empty color information.`
                );
                return this.emptyColorInformationResponse;
            }

            const textDocument = await vscode.workspace.openTextDocument(razorDocumentUri);
            const synchronized = await this.documentSynchronizer.trySynchronizeProjectedDocument(
                textDocument,
                razorDocument.htmlDocument,
                documentColorParams._razor_hostDocumentVersion,
                cancellationToken
            );
            if (!synchronized) {
                return this.emptyColorInformationResponse;
            }

            const virtualHtmlUri = razorDocument.htmlDocument.uri;
            return await DocumentColorHandler.doDocumentColorRequest(virtualHtmlUri);
        } catch (error) {
            this.logger.logWarning(`${DocumentColorHandler.provideHtmlDocumentColorEndpoint} failed with ${error}`);
        }

        return this.emptyColorInformationResponse;
    }

    public static async doDocumentColorRequest(virtualHtmlUri: vscode.Uri) {
        const colorInformation = await vscode.commands.executeCommand<vscode.ColorInformation[]>(
            'vscode.executeDocumentColorProvider',
            virtualHtmlUri
        );

        const serializableColorInformation = new Array<SerializableColorInformation>();
        for (const color of colorInformation) {
            const serializableRange = convertRangeToSerializable(color.range);
            const serializableColor = new SerializableColorInformation(serializableRange, color.color);
            serializableColorInformation.push(serializableColor);
        }

        return serializableColorInformation;
    }
}

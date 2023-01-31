/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-languageclient';
import { RazorDocumentManager } from '../Document/RazorDocumentManager';
import { RazorLanguageServerClient } from '../RazorLanguageServerClient';
import { RazorLogger } from '../RazorLogger';
import { convertRangeToSerializable } from '../RPC/SerializableRange';
import { SerializableColorInformation } from './SerializableColorInformation';
import { SerializableDocumentColorParams } from './SerializableDocumentColorParams';

export class DocumentColorHandler {
    private static readonly provideHtmlDocumentColorEndpoint = 'razor/provideHtmlDocumentColor';
    private documentColorRequestType: RequestType<SerializableDocumentColorParams, SerializableColorInformation[], any> = new RequestType(DocumentColorHandler.provideHtmlDocumentColorEndpoint);
    private emptyColorInformationResponse: SerializableColorInformation[] = [];

    constructor(
        private readonly documentManager: RazorDocumentManager,
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger) { }

    public register() {
        // tslint:disable-next-line: no-floating-promises
        this.serverClient.onRequestWithParams<SerializableDocumentColorParams, SerializableColorInformation[], any>(
            this.documentColorRequestType,
            async (request: SerializableDocumentColorParams, token: vscode.CancellationToken) => this.provideHtmlDocumentColors(request, token));
    }

    private async provideHtmlDocumentColors(
        documentColorParams: SerializableDocumentColorParams,
        cancellationToken: vscode.CancellationToken) {
        try {
            const razorDocumentUri = vscode.Uri.parse(documentColorParams.textDocument.uri, true);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                this.logger.logWarning(`Could not find Razor document ${razorDocumentUri}; returning empty color information.`);
                return this.emptyColorInformationResponse;
            }

            const virtualHtmlUri = razorDocument.htmlDocument.uri;

            const colorInformation = await vscode.commands.executeCommand<vscode.ColorInformation[]>(
                'vscode.executeDocumentColorProvider',
                virtualHtmlUri);

            const serializableColorInformation = new Array<SerializableColorInformation>();
            for (const color of colorInformation) {
                const serializableRange = convertRangeToSerializable(color.range);
                const serializableColor = new SerializableColorInformation(serializableRange, color.color);
                serializableColorInformation.push(serializableColor);
            }

            return serializableColorInformation;
        } catch (error) {
            this.logger.logWarning(`${DocumentColorHandler.provideHtmlDocumentColorEndpoint} failed with ${error}`);
        }

        return this.emptyColorInformationResponse;
    }
}

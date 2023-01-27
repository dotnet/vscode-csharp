/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-languageclient';
import { RazorDocumentManager } from '../Document/RazorDocumentManager';
import { RazorLanguageServerClient } from '../RazorLanguageServerClient';
import { RazorLogger } from '../RazorLogger';
import { convertTextEditToSerializable, SerializableTextEdit } from '../RPC/SerializableTextEdit';
import { SerializableFormattingParams } from './SerializableFormattingParams';
import { SerializableFormattingResponse } from './SerializableFormattingResponse';

export class FormattingHandler {
    private static readonly provideFormattingEndpoint = 'textDocument/formatting';
    private formattingRequestType: RequestType<SerializableFormattingParams, SerializableFormattingResponse, any> = new RequestType(FormattingHandler.provideFormattingEndpoint);
    private emptyFormattingResponse = new SerializableFormattingResponse();

    constructor(
        private readonly documentManager: RazorDocumentManager,
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger) { }

    public register() {
        // tslint:disable-next-line: no-floating-promises
        this.serverClient.onRequestWithParams<SerializableFormattingParams, SerializableFormattingResponse, any>(
            this.formattingRequestType,
            async (request, token) => this.provideFormatting(request, token));
    }

    private async provideFormatting(
        formattingParams: SerializableFormattingParams,
        cancellationToken: vscode.CancellationToken) {
        try {
            const razorDocumentUri = vscode.Uri.parse(formattingParams.textDocument.uri);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                return this.emptyFormattingResponse;
            }

            const virtualHtmlUri = razorDocument.htmlDocument.uri;

            const textEdits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
                'vscode.executeFormatDocumentProvider',
                virtualHtmlUri,
                formattingParams.options);

            const serializableTextEdits = Array<SerializableTextEdit>();
            for (const textEdit of textEdits) {
                const serializableTextEdit = convertTextEditToSerializable(textEdit);
                serializableTextEdits.push(serializableTextEdit);
            }

            return new SerializableFormattingResponse(serializableTextEdits);
        } catch (error) {
            this.logger.logWarning(`${FormattingHandler.provideFormattingEndpoint} failed with ${error}`);
        }

        return this.emptyFormattingResponse;
    }
}

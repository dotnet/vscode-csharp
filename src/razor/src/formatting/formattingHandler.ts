/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-jsonrpc';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { RazorDocumentSynchronizer } from '../document/razorDocumentSynchronizer';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { RazorLogger } from '../razorLogger';
import { convertTextEditToSerializable, SerializableTextEdit } from '../rpc/serializableTextEdit';
import { SerializableFormattingParams } from './serializableFormattingParams';
import { SerializableFormattingResponse } from './serializableFormattingResponse';
import { SerializableOnTypeFormattingParams } from './serializableOnTypeFormattingParams';
import { SerializablePosition } from '../rpc/serializablePosition';

export class FormattingHandler {
    private static readonly provideFormattingEndpoint = 'razor/htmlFormatting';
    private static readonly provideOnTypeFormattingEndpoint = 'razor/htmlOnTypeFormatting';
    private formattingRequestType: RequestType<SerializableFormattingParams, SerializableFormattingResponse, any> =
        new RequestType(FormattingHandler.provideFormattingEndpoint);
    private onTypeFormattingRequestType: RequestType<
        SerializableOnTypeFormattingParams,
        SerializableFormattingResponse,
        any
    > = new RequestType(FormattingHandler.provideOnTypeFormattingEndpoint);
    private static emptyFormattingResponse = new SerializableFormattingResponse();

    constructor(
        private readonly documentManager: RazorDocumentManager,
        private readonly documentSynchronizer: RazorDocumentSynchronizer,
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger
    ) {}

    public async register() {
        await this.serverClient.onRequestWithParams<SerializableFormattingParams, SerializableFormattingResponse, any>(
            this.formattingRequestType,
            async (request, token) => this.provideFormatting(request, token)
        );
        await this.serverClient.onRequestWithParams<
            SerializableOnTypeFormattingParams,
            SerializableFormattingResponse,
            any
        >(this.onTypeFormattingRequestType, async (request, token) => this.provideOnTypeFormatting(request, token));
    }

    private async provideFormatting(
        formattingParams: SerializableFormattingParams,
        cancellationToken: vscode.CancellationToken
    ) {
        try {
            const razorDocumentUri = vscode.Uri.parse(formattingParams.textDocument.uri);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                return FormattingHandler.emptyFormattingResponse;
            }

            const textDocument = await vscode.workspace.openTextDocument(razorDocumentUri);
            const synchronized = await this.documentSynchronizer.trySynchronizeProjectedDocument(
                textDocument,
                razorDocument.htmlDocument,
                formattingParams.hostDocumentVersion,
                cancellationToken
            );
            if (!synchronized) {
                return FormattingHandler.emptyFormattingResponse;
            }

            const virtualHtmlUri = razorDocument.htmlDocument.uri;
            const htmlDocContent = razorDocument.htmlDocument.getContent();

            return await FormattingHandler.getHtmlFormattingResult(
                virtualHtmlUri,
                htmlDocContent,
                formattingParams.options
            );
        } catch (error) {
            this.logger.logWarning(`${FormattingHandler.provideFormattingEndpoint} failed with ${error}`);
        }

        return FormattingHandler.emptyFormattingResponse;
    }

    public static async getHtmlFormattingResult(
        virtualHtmlUri: vscode.Uri,
        htmlDocContent: string,
        options: vscode.FormattingOptions
    ): Promise<SerializableFormattingResponse> {
        // This is a workaround for https://github.com/microsoft/vscode/issues/191395.
        // We need to call the HTML range formatter instead of document formattter since
        // the latter does not respect HTML settings.
        const zeroBasedNumLinesHtmlDoc = FormattingHandler.countLines(htmlDocContent);
        const lastLineLengthHtmlDoc = FormattingHandler.getLastLineLength(htmlDocContent);
        const range = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(zeroBasedNumLinesHtmlDoc, lastLineLengthHtmlDoc)
        );

        const textEdits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
            'vscode.executeFormatRangeProvider',
            virtualHtmlUri,
            range,
            options
        );

        if (textEdits === undefined) {
            return FormattingHandler.emptyFormattingResponse;
        }

        const serializableTextEdits = FormattingHandler.sanitizeTextEdits(htmlDocContent, textEdits);

        return new SerializableFormattingResponse(serializableTextEdits);
    }

    public static async getHtmlOnTypeFormattingResult(
        virtualHtmlUri: vscode.Uri,
        htmlDocContent: string,
        position: SerializablePosition,
        ch: string,
        options: vscode.FormattingOptions
    ): Promise<SerializableFormattingResponse> {
        const textEdits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
            'vscode.executeFormatOnTypeProvider',
            virtualHtmlUri,
            position,
            ch,
            options
        );

        if (textEdits === undefined) {
            return FormattingHandler.emptyFormattingResponse;
        }

        const serializableTextEdits = FormattingHandler.sanitizeTextEdits(htmlDocContent, textEdits);

        return new SerializableFormattingResponse(serializableTextEdits);
    }

    private async provideOnTypeFormatting(
        formattingParams: SerializableOnTypeFormattingParams,
        cancellationToken: vscode.CancellationToken
    ) {
        try {
            const razorDocumentUri = vscode.Uri.parse(formattingParams.textDocument.uri);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                return FormattingHandler.emptyFormattingResponse;
            }

            const textDocument = await vscode.workspace.openTextDocument(razorDocumentUri);
            const synchronized = await this.documentSynchronizer.trySynchronizeProjectedDocument(
                textDocument,
                razorDocument.csharpDocument,
                formattingParams.hostDocumentVersion,
                cancellationToken
            );
            if (!synchronized) {
                return FormattingHandler.emptyFormattingResponse;
            }

            const virtualHtmlUri = razorDocument.htmlDocument.uri;
            const htmlDocContent = razorDocument.htmlDocument.getContent();

            return await FormattingHandler.getHtmlOnTypeFormattingResult(
                virtualHtmlUri,
                htmlDocContent,
                formattingParams.position,
                formattingParams.ch,
                formattingParams.options
            );
        } catch (error) {
            this.logger.logWarning(`${FormattingHandler.provideFormattingEndpoint} failed with ${error}`);
        }

        return FormattingHandler.emptyFormattingResponse;
    }

    private static sanitizeTextEdits(htmlDocText: string, textEdits: vscode.TextEdit[]) {
        const zeroBasedLineCount = FormattingHandler.countLines(htmlDocText);
        const serializableTextEdits = Array<SerializableTextEdit>();
        for (let textEdit of textEdits) {
            // The below workaround is needed due to a bug on the HTML side where
            // they'll sometimes send us an end position that exceeds the length
            // of the document. Tracked by https://github.com/microsoft/vscode/issues/175298.
            if (textEdit.range.end.line > zeroBasedLineCount || textEdit.range.start.line > zeroBasedLineCount) {
                const lastLineLength = FormattingHandler.getLastLineLength(htmlDocText);
                const updatedPosition = new vscode.Position(zeroBasedLineCount, lastLineLength);

                let start = textEdit.range.start;
                let end = textEdit.range.end;
                if (textEdit.range.start.line > zeroBasedLineCount) {
                    start = updatedPosition;
                }

                if (textEdit.range.end.line > zeroBasedLineCount) {
                    end = updatedPosition;
                }

                const updatedRange = new vscode.Range(start, end);
                textEdit = new vscode.TextEdit(updatedRange, textEdit.newText);
            }

            const serializableTextEdit = convertTextEditToSerializable(textEdit);
            serializableTextEdits.push(serializableTextEdit);
        }
        return serializableTextEdits;
    }

    private static countLines(text: string) {
        let lineCount = 0;
        for (const i of text) {
            if (i === '\n') {
                lineCount++;
            }
        }

        return lineCount;
    }

    private static getLastLineLength(text: string) {
        let currentLineLength = 0;
        for (let i = 0; i < text.length; i++) {
            // Take into account different line ending types ('\r\n' vs. '\n')
            if (i + 1 < text.length && text[i] === '\r' && text[i + 1] === '\n') {
                currentLineLength = 0;
                i++;
            } else if (text[i] === '\n') {
                currentLineLength = 0;
            } else {
                currentLineLength++;
            }
        }

        return currentLineLength;
    }
}

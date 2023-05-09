/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-languageclient';
import { IRazorDocument } from '../Document/IRazorDocument';
import { RazorDocumentManager } from '../Document/RazorDocumentManager';
import { RazorDocumentSynchronizer } from '../Document/RazorDocumentSynchronizer';
import { RazorLanguageServerClient } from '../RazorLanguageServerClient';
import { RazorLogger } from '../RazorLogger';
import { convertTextEditToSerializable, SerializableTextEdit } from '../RPC/SerializableTextEdit';
import { SerializableFormattingParams } from './SerializableFormattingParams';
import { SerializableFormattingResponse } from './SerializableFormattingResponse';
import { SerializableOnTypeFormattingParams } from './SerializableOnTypeFormattingParams';

export class FormattingHandler {
    private static readonly provideFormattingEndpoint = 'razor/htmlFormatting';
    private static readonly provideOnTypeFormattingEndpoint = 'razor/htmlOnTypeFormatting';
    private formattingRequestType: RequestType<SerializableFormattingParams, SerializableFormattingResponse, any> = new RequestType(FormattingHandler.provideFormattingEndpoint);
    private onTypeFormattingRequestType: RequestType<SerializableOnTypeFormattingParams, SerializableFormattingResponse, any> = new RequestType(FormattingHandler.provideOnTypeFormattingEndpoint);
    private emptyFormattingResponse = new SerializableFormattingResponse();

    constructor(
        private readonly documentManager: RazorDocumentManager,
        private readonly documentSynchronizer: RazorDocumentSynchronizer,
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger) { }

    public async register() {
        await this.serverClient.onRequestWithParams<SerializableFormattingParams, SerializableFormattingResponse, any>(
            this.formattingRequestType,
            async (request, token) => this.provideFormatting(request, token));
        // tslint:disable-next-line: no-floating-promises
        this.serverClient.onRequestWithParams<SerializableOnTypeFormattingParams, SerializableFormattingResponse, any>(
            this.onTypeFormattingRequestType,
            async (request, token) => this.provideOnTypeFormatting(request, token));
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

            const textDocument = await vscode.workspace.openTextDocument(razorDocumentUri);
            const synchronized = await this.documentSynchronizer.trySynchronizeProjectedDocument(textDocument, razorDocument.csharpDocument, formattingParams.hostDocumentVersion, cancellationToken);
            if (!synchronized) {
                return this.emptyFormattingResponse;
            }

            const virtualHtmlUri = razorDocument.htmlDocument.uri;

            const textEdits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
                'vscode.executeFormatDocumentProvider',
                virtualHtmlUri,
                formattingParams.options);

            if (textEdits === undefined) {
                return this.emptyFormattingResponse;
            }

            const serializableTextEdits = this.sanitizeTextEdits(razorDocument, textEdits);

            return new SerializableFormattingResponse(serializableTextEdits);
        } catch (error) {
            this.logger.logWarning(`${FormattingHandler.provideFormattingEndpoint} failed with ${error}`);
        }

        return this.emptyFormattingResponse;
    }

    private async provideOnTypeFormatting(
        formattingParams: SerializableOnTypeFormattingParams,
        cancellationToken: vscode.CancellationToken) {
        try {
            const razorDocumentUri = vscode.Uri.parse(formattingParams.textDocument.uri);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                return this.emptyFormattingResponse;
            }

            const textDocument = await vscode.workspace.openTextDocument(razorDocumentUri);
            const synchronized = await this.documentSynchronizer.trySynchronizeProjectedDocument(textDocument, razorDocument.csharpDocument, formattingParams.hostDocumentVersion, cancellationToken);
            if (!synchronized) {
                return this.emptyFormattingResponse;
            }

            const virtualHtmlUri = razorDocument.htmlDocument.uri;

            const textEdits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
                'vscode.executeFormatOnTypeProvider',
                virtualHtmlUri,
                formattingParams.position,
                formattingParams.ch,
                formattingParams.options);

            if (textEdits === undefined) {
                return this.emptyFormattingResponse;
            }

            const serializableTextEdits = this.sanitizeTextEdits(razorDocument, textEdits);

            return new SerializableFormattingResponse(serializableTextEdits);
        } catch (error) {
            this.logger.logWarning(`${FormattingHandler.provideFormattingEndpoint} failed with ${error}`);
        }

        return this.emptyFormattingResponse;
    }

    private sanitizeTextEdits(razorDocument: IRazorDocument, textEdits: vscode.TextEdit[]) {
        const htmlDocText = razorDocument.htmlDocument.getContent();
        const zeroBasedLineCount = this.countLines(htmlDocText);
        const serializableTextEdits = Array<SerializableTextEdit>();
        for (let textEdit of textEdits) {
            // The below workaround is needed due to a bug on the HTML side where
            // they'll sometimes send us an end position that exceeds the length
            // of the document. Tracked by https://github.com/microsoft/vscode/issues/175298.
            if (textEdit.range.end.line > zeroBasedLineCount ||
                textEdit.range.start.line > zeroBasedLineCount) {
                const lastLineLength = this.getLastLineLength(htmlDocText);
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

    private countLines(text: string) {
        let lineCount = 0;
        for (const i of text) {
            if (i === '\n') {
                lineCount++;
            }
        }

        return lineCount;
    }

    private getLastLineLength(text: string) {
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { convertTextEditToSerializable, SerializableTextEdit } from '../rpc/serializableTextEdit';
import { SerializableFormattingResponse } from './serializableFormattingResponse';
import { SerializablePosition } from '../rpc/serializablePosition';

export class FormattingHandler {
    private static emptyFormattingResponse = new SerializableFormattingResponse();

    constructor() {}

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

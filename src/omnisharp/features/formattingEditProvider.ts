/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as protocol from '../protocol';
import * as serverUtils from '../utils';
import {
    DocumentRangeFormattingEditProvider,
    FormattingOptions,
    CancellationToken,
    TextEdit,
    TextDocument,
    Range,
    Position,
} from 'vscode';

export default class OmniSharpFormatProvider extends AbstractSupport implements DocumentRangeFormattingEditProvider {
    public async provideDocumentRangeFormattingEdits(
        document: TextDocument,
        range: Range,
        options: FormattingOptions,
        token: CancellationToken
    ): Promise<TextEdit[]> {
        const request = <protocol.FormatRangeRequest>{
            FileName: document.fileName,
            Line: range.start.line,
            Column: range.start.character,
            EndLine: range.end.line,
            EndColumn: range.end.character,
        };

        try {
            const res = await serverUtils.formatRange(this._server, request, token);
            if (res && Array.isArray(res.Changes)) {
                return res.Changes.map(OmniSharpFormatProvider._asEditOptionation);
            }
        } catch {
            /* empty */
        }

        return [];
    }

    public async provideOnTypeFormattingEdits(
        document: TextDocument,
        position: Position,
        ch: string,
        options: FormattingOptions,
        token: CancellationToken
    ): Promise<TextEdit[]> {
        const request = <protocol.FormatAfterKeystrokeRequest>{
            FileName: document.fileName,
            Line: position.line,
            Column: position.character,
            Character: ch,
        };

        try {
            const res = await serverUtils.formatAfterKeystroke(this._server, request, token);
            if (res && Array.isArray(res.Changes)) {
                return res.Changes.map(OmniSharpFormatProvider._asEditOptionation);
            }
        } catch {
            /* empty */
        }

        return [];
    }

    private static _asEditOptionation(change: protocol.TextChange): TextEdit {
        return new TextEdit(
            new Range(change.StartLine, change.StartColumn, change.EndLine, change.EndColumn),
            change.NewText
        );
    }
}

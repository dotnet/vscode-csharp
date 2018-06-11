/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as protocol from './protocol';
import * as vscode from 'vscode';

export function toLocation(location: protocol.ResourceLocation | protocol.QuickFix): vscode.Location {
    const fileName = vscode.Uri.file(location.FileName);
    return toLocationFromUri(fileName, location);
}

export function toLocationFromUri(uri: vscode.Uri, location: protocol.ResourceLocation | protocol.QuickFix): vscode.Location {
    const position = new vscode.Position(location.Line - 1, location.Column - 1);

    const endLine = (<protocol.QuickFix>location).EndLine;
    const endColumn = (<protocol.QuickFix>location).EndColumn;

    if (endLine !== undefined && endColumn !== undefined) {
        const endPosition = new vscode.Position(endLine - 1, endColumn - 1);
        return new vscode.Location(uri, new vscode.Range(position, endPosition));
    }

    return new vscode.Location(uri, position);
}

export function toRange(rangeLike: { Line: number; Column: number; EndLine: number; EndColumn: number; }): vscode.Range {
    let {Line, Column, EndLine, EndColumn} = rangeLike;
    return new vscode.Range(Line - 1, Column - 1, EndLine - 1, EndColumn - 1);
}

export function toRange2(rangeLike: { StartLine: number; StartColumn: number; EndLine: number; EndColumn: number; }): vscode.Range {
    let {StartLine, StartColumn, EndLine, EndColumn} = rangeLike;
    return new vscode.Range(StartLine - 1, StartColumn - 1, EndLine - 1, EndColumn - 1);
}

export function createRequest<T extends protocol.Request>(document: vscode.TextDocument, where: vscode.Position | vscode.Range, includeBuffer: boolean = false): T {

    let Line: number, Column: number;

    if (where instanceof vscode.Position) {
        Line = where.line + 1;
        Column = where.character + 1;
    } else if (where instanceof vscode.Range) {
        Line = where.start.line + 1;
        Column = where.start.character + 1;
    }

    // for metadata sources, we need to remove the [metadata] from the filename, and prepend the $metadata$ authority
    // this is expected by the Omnisharp server to support metadata-to-metadata navigation
    let fileName = document.uri.scheme === "omnisharp-metadata" ? 
        `${document.uri.authority}${document.fileName.replace("[metadata] ", "")}` : 
        document.fileName;

    let request: protocol.Request = {
        FileName: fileName,
        Buffer: includeBuffer ? document.getText() : undefined,
        Line,
        Column
    };

    return <T>request;
}

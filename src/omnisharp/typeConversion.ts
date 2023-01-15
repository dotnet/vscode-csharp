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
    const position = new vscode.Position(location.Line, location.Column);

    const endLine = (<protocol.QuickFix>location).EndLine;
    const endColumn = (<protocol.QuickFix>location).EndColumn;

    if (endLine !== undefined && endColumn !== undefined) {
        const endPosition = new vscode.Position(endLine, endColumn);
        return new vscode.Location(uri, new vscode.Range(position, endPosition));
    }

    return new vscode.Location(uri, position);
}

export function toVscodeLocation(omnisharpLocation: protocol.V2.Location): vscode.Location {
    return new vscode.Location(vscode.Uri.file(omnisharpLocation.FileName), toRange3(omnisharpLocation.Range));
}

export function toRange(rangeLike: { Line: number; Column: number; EndLine: number; EndColumn: number; }): vscode.Range {
    let { Line, Column, EndLine, EndColumn } = rangeLike;
    return toVSCodeRange(Line, Column, EndLine, EndColumn);
}

export function toRange2(rangeLike: { StartLine: number; StartColumn: number; EndLine: number; EndColumn: number; }): vscode.Range {
    let { StartLine, StartColumn, EndLine, EndColumn } = rangeLike;
    return toVSCodeRange(StartLine, StartColumn, EndLine, EndColumn);
}

export function toRange3(range: protocol.V2.Range): vscode.Range {
    return toVSCodeRange(range.Start.Line, range.Start.Column, range.End.Line, range.End.Column);
}

export function toVSCodeRange(StartLine: number, StartColumn: number, EndLine: number, EndColumn: number): vscode.Range {
    return new vscode.Range(StartLine, StartColumn, EndLine, EndColumn);
}

export function fromVSCodeRange(range: vscode.Range): protocol.V2.Range {
    return {
        Start: fromVSCodePosition(range.start),
        End: fromVSCodePosition(range.end)
    };
}

export function fromVSCodePosition(position: vscode.Position): protocol.V2.Point {
    return { Line: position.line, Column: position.character };
}

export function toVSCodePosition(point: protocol.V2.Point): vscode.Position {
    return new vscode.Position(point.Line, point.Column);
}

export function toVSCodeTextEdit(textChange: protocol.LinePositionSpanTextChange): vscode.TextEdit {
    return new vscode.TextEdit(toRange2(textChange), textChange.NewText);
}

export function createRequest<T extends protocol.Request>(document: vscode.TextDocument, where: vscode.Position, includeBuffer: boolean = false): T {
    // for metadata sources, we need to remove the [metadata] from the filename, and prepend the $metadata$ authority
    // this is expected by the Omnisharp server to support metadata-to-metadata navigation
    const fileName = document.uri.scheme === "omnisharp-metadata" ?
        `${document.uri.authority}${document.fileName.replace("[metadata] ", "")}` :
        document.fileName;

    const request: protocol.Request = {
        FileName: fileName,
        Buffer: includeBuffer ? document.getText() : undefined,
        Line: where.line,
        Column: where.character,
    };

    return <T>request;
}

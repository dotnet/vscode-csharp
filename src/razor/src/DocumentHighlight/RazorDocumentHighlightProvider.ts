/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { RazorLanguageFeatureBase } from './../RazorLanguageFeatureBase';
import { LanguageKind } from './../RPC/LanguageKind';

export class RazorDocumentHighlightProvider
    extends RazorLanguageFeatureBase
    implements vscode.DocumentHighlightProvider {

    public async provideDocumentHighlights(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken) {

        const projection = await this.getProjection(document, position, token);
        if (!projection || projection.languageKind === LanguageKind.Razor) {
            return;
        }

        const highlights = await vscode.commands.executeCommand<vscode.DocumentHighlight[]>(
            'vscode.executeDocumentHighlights',
            projection.uri,
            projection.position);

        if (!highlights || highlights.length === 0) {
            return;
        }

        const remappedHighlights = new Array<vscode.DocumentHighlight>();

        // Re-map the projected document ranges to host document ranges
        for (const highlight of highlights) {
            const remappedResponse = await this.serviceClient.mapToDocumentRanges(
                projection.languageKind,
                [highlight.range],
                document.uri);

            if (!remappedResponse ||
                !remappedResponse.ranges ||
                !remappedResponse.ranges[0]) {
                // Couldn't remap the projected highlight location.
                continue;
            }

            if (document.version !== remappedResponse.hostDocumentVersion) {
                // This highlight result is for a different version of the text document, bail.
                continue;
            }

            const remappedHighlight = new vscode.DocumentHighlight(
                remappedResponse.ranges[0],
                highlight.kind);
            remappedHighlights.push(remappedHighlight);
        }

        return remappedHighlights;
    }
}

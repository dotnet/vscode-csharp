/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { RazorLanguageFeatureBase } from '../RazorLanguageFeatureBase';

export class RazorDocumentSemanticTokensProvider
    extends RazorLanguageFeatureBase
    implements vscode.DocumentRangeSemanticTokensProvider {
    public async provideDocumentRangeSemanticTokens(
        document: vscode.TextDocument,
        range: vscode.Range,
        token: vscode.CancellationToken,
    ): Promise<vscode.SemanticTokens | undefined> {
        let semanticRangeResponse = await this.serviceClient.semanticTokensRange(document.uri, range);

        if (semanticRangeResponse) {
            // However we're serializing into Uint32Array doesn't set byteLength, which is checked by some stuff under the covers.
            // Solution? Create a new one, blat it over the old one, go home for the weekend.
            const fixedArray = new Uint32Array(semanticRangeResponse.data);
            semanticRangeResponse = new vscode.SemanticTokens(fixedArray, semanticRangeResponse.resultId);
        }

        return semanticRangeResponse;
    }
}

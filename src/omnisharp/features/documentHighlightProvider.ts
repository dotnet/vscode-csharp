/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider.ts';
import * as protocol from '../protocol.ts';
import * as serverUtils from '../utils.ts';
import { createRequest, toRange } from '../typeConversion.ts';
import {
    DocumentHighlightProvider,
    DocumentHighlight,
    DocumentHighlightKind,
    CancellationToken,
    TextDocument,
    Position,
} from 'vscode';

export default class OmniSharpDocumentHighlightProvider extends AbstractSupport implements DocumentHighlightProvider {
    public async provideDocumentHighlights(
        resource: TextDocument,
        position: Position,
        token: CancellationToken
    ): Promise<DocumentHighlight[]> {
        const req = createRequest<protocol.FindUsagesRequest>(resource, position);
        req.OnlyThisFile = true;
        req.ExcludeDefinition = false;

        try {
            const res = await serverUtils.findUsages(this._server, req, token);

            if (res && Array.isArray(res.QuickFixes)) {
                return res.QuickFixes.map(OmniSharpDocumentHighlightProvider._asDocumentHighlight);
            }
        } catch {
            /* empty */
        }

        return [];
    }

    private static _asDocumentHighlight(quickFix: protocol.QuickFix): DocumentHighlight {
        return new DocumentHighlight(toRange(quickFix), DocumentHighlightKind.Read);
    }
}

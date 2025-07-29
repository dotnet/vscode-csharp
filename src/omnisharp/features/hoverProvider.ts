/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as protocol from '../protocol';
import * as serverUtils from '../utils';
import { createRequest } from '../typeConversion';
import { HoverProvider, Hover, TextDocument, CancellationToken, Position, MarkdownString } from 'vscode';

export default class OmniSharpHoverProvider extends AbstractSupport implements HoverProvider {
    public async provideHover(
        document: TextDocument,
        position: Position,
        token: CancellationToken
    ): Promise<Hover | undefined> {
        const request = createRequest<protocol.QuickInfoRequest>(document, position);
        try {
            const response = await serverUtils.getQuickInfo(this._server, request, token);
            if (!response || !response.Markdown) {
                return undefined;
            }

            const markdownString = new MarkdownString();
            markdownString.appendMarkdown(response.Markdown);

            return new Hover(markdownString);
        } catch (_) {
            return undefined;
        }
    }
}

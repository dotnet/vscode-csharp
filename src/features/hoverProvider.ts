/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { createRequest } from '../omnisharp/typeConversion';
import { HoverProvider, Hover, TextDocument, CancellationToken, Position, MarkdownString } from 'vscode';

export default class OmniSharpHoverProvider extends AbstractSupport implements HoverProvider {

    public async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover> {
        let request = createRequest<protocol.QuickInfoRequest>(document, position);
        try {
            const response = await serverUtils.getQuickInfo(this._server, request, token);
            if (!response || !response.Sections) {
                return undefined;
            }

            let markdownString = new MarkdownString;
            const language = "csharp";
            for (const section of response.Sections) {
                if (section.IsCSharpCode) {
                    markdownString.appendCodeblock(section.Text, language);
                }
                else {
                    markdownString.appendText("\n");
                    markdownString.appendMarkdown(section.Text);
                }
            }

            return new Hover(markdownString);
        }
        catch (error) {
            return undefined;
        }
    }
}

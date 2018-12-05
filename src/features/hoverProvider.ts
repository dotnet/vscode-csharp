/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { createRequest } from '../omnisharp/typeConversion';
import { HoverProvider, Hover, TextDocument, CancellationToken, Position } from 'vscode';
import { GetDocumentationString } from './documentation';

export default class OmniSharpHoverProvider extends AbstractSupport implements HoverProvider {

    public async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover> {

        let req = createRequest<protocol.TypeLookupRequest>(document, position);
        req.IncludeDocumentation = true;

        try {
            let value = await serverUtils.typeLookup(this._server, req, token);
            if (value && value.Type) {
                let documentation = GetDocumentationString(value.StructuredDocumentation);
                let contents = [documentation, { language: 'csharp', value: value.Type }];
                return new Hover(contents);
            }
        }
        catch (error) {
            return undefined; //No hover result could be obtained
        }
    }
}
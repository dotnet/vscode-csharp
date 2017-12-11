/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import {createRequest} from '../omnisharp/typeConvertion';

import {HoverProvider, Hover, TextDocument, CancellationToken, Position} from 'vscode';

export default class OmniSharpHoverProvider extends AbstractSupport implements HoverProvider {

    public provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover> {

        let req = createRequest<protocol.TypeLookupRequest>(document, position);
        req.IncludeDocumentation = true;

        return serverUtils.typeLookup(this._server, req, token).then(value => {
            if (value && value.Type) {
                let structDoc = value.StructuredDocumentation ;
                let newLine = "\n\n";
                let documentation = "";
                if (structDoc.SummaryText) {
                    documentation += structDoc.SummaryText + newLine;
                }
                if (structDoc.TypeParamElements && structDoc.TypeParamElements.length > 0) {
                    documentation += "Type Parameters:" + newLine;
                    documentation += structDoc.TypeParamElements.join(newLine) + newLine;
                } 
                if (structDoc.ParamElements && structDoc.ParamElements.length > 0) {
                    documentation += "Parameters:" + newLine;
                    documentation += structDoc.ParamElements.join(newLine) + newLine;
                }
                if (structDoc.ReturnsText) {
                    documentation += structDoc.ReturnsText + newLine;
                }
                if (structDoc.RemarksText) {
                    documentation += structDoc.RemarksText + newLine;
                }
                if (structDoc.ExampleText) {
                    documentation += structDoc.ExampleText + newLine;
                }
                if (structDoc.ValueText) {
                    documentation += structDoc.ValueText + newLine;
                }
                if (structDoc.Exception && structDoc.Exception.length > 0) {
                    documentation += "Exceptions:" + newLine;
                    documentation += structDoc.Exception.join(newLine) + newLine;
                }

                documentation = documentation.trim();
                let contents = [documentation, { language: 'csharp', value: value.Type }];
                return new Hover(contents);
            }
        });
    }
}
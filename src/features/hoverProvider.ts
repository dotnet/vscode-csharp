/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {extractSummaryText} from './documentation';
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
                let structuredDocumentation = value.StructuredDocumentation ;
                let newline = "\n\n";
                let ParamText = structuredDocumentation.ParamElements.join(newline);
                if(ParamText.length>0)
                {
                    ParamText = "Parameters:\n\n"+ ParamText;
                }

                let TypeParamText = structuredDocumentation.TypeParamElements.join(newline);
                if(TypeParamText.length>0)
                {
                    TypeParamText = "TypeParameters:\n\n"+TypeParamText;
                }
                
                let ExceptionText = structuredDocumentation.Exception.join(newline);
                if(ExceptionText.length>0)
                {
                    ExceptionText = "Exceptions:\n\n"+ ExceptionText;
                }

                let documentation = 
                structuredDocumentation.SummaryText + newline +
                ParamText + newline +
                TypeParamText + newline +
                structuredDocumentation.ValueText + newline +
                structuredDocumentation.ExampleText + newline +
                structuredDocumentation.RemarksText + newline +
                structuredDocumentation.ReturnsText + newline +
                ExceptionText;
                let contents = [documentation, { language: 'csharp', value: value.Type }];
                return new Hover(contents);
            }
        });
    }
}
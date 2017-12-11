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
                let newline = "\n\n";
                let documentation = "";
                Object.getOwnPropertyNames(structDoc).forEach(
                    function (val) {
                        if(Array.isArray(structDoc[val])){
                            if(structDoc[val].length>0){
                                if(val=="ParamElements"){
                                    documentation += "Parameters:" ;
                                }
                                else if(val=="TypeParamElements"){
                                    documentation += "TypeParameters:";
                                }
                                else{
                                    documentation += "Exceptions:";
                                }
                                documentation += newline + structDoc[val].join(newline) + newline;
                             }
                         }
                        else if(structDoc[val]){
                            documentation += structDoc[val] + newline;
                        } 
                    }
                );
                documentation = documentation.trim();
                let contents = [documentation, { language: 'csharp', value: value.Type }];
                return new Hover(contents);
            }
        });
    }
}
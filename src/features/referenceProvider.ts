/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import {createRequest, toLocation} from '../omnisharp/typeConversion';
import {ReferenceProvider, Location, TextDocument, CancellationToken, Position} from 'vscode';

export default class OmnisharpReferenceProvider extends AbstractSupport implements ReferenceProvider {

    public async provideReferences(document: TextDocument, position: Position, options: { includeDeclaration: boolean;}, token: CancellationToken): Promise<Location[]> {

        let req = createRequest<protocol.FindUsagesRequest>(document, position);
        req.OnlyThisFile = false;
        req.ExcludeDefinition = true;

        try {
            let res = await serverUtils.findUsages(this._server, req, token);
            if (res && Array.isArray(res.QuickFixes)) {
                const references = res.QuickFixes.map(toLocation);
                
                // Allow language middlewares to re-map its edits if necessary.
                const result = await this._languageMiddlewareFeature.remap("remapLocations", references, token);
                return result;
            }
        }
        catch (error) {
            return [];
        }
    }
}

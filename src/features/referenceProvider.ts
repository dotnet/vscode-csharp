/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import {createRequest, toLocation} from '../omnisharp/typeConvertion';
import {ReferenceProvider, Location, TextDocument, CancellationToken, Position} from 'vscode';

export default class OmnisharpReferenceProvider extends AbstractSupport implements ReferenceProvider {

    public async provideReferences(document: TextDocument, position: Position, options: { includeDeclaration: boolean;}, token: CancellationToken): Promise<Location[]> {

        let req = createRequest<protocol.FindUsagesRequest>(document, position);
        req.OnlyThisFile = false;
        req.ExcludeDefinition = false;

        return serverUtils.findUsages(this._server, req, token).then(res => {
            if (res && Array.isArray(res.QuickFixes)) {
                return res.QuickFixes.map(toLocation);
            }
        });
    }
}

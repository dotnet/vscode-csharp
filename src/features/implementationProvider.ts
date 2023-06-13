/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import { FindImplementationsRequest } from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { createRequest, toLocation } from '../omnisharp/typeConversion';
import { TextDocument, Position, CancellationToken, ImplementationProvider, Definition } from 'vscode';

export default class OmniSharpImplementationProvider extends AbstractSupport implements ImplementationProvider {
    public async provideImplementation(document: TextDocument, position: Position, token: CancellationToken): Promise<Definition | undefined> {
        const request = createRequest<FindImplementationsRequest>(document, position);

        try {
            const response = await serverUtils.findImplementations(this._server, request, token);
            const implementations = response?.QuickFixes?.map(fix => toLocation(fix)) ?? [];

            // Allow language middlewares to re-map its edits if necessary.
            const result = await this._languageMiddlewareFeature.remap("remapLocations", implementations, token);
            return result;
        } catch {}

        return undefined;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import { FindImplementationsRequest } from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { createRequest, toLocation } from '../omnisharp/typeConversion';
import { TextDocument, Position, CancellationToken, ImplementationProvider, Definition } from 'vscode';

export default class CSharpImplementationProvider extends AbstractSupport implements ImplementationProvider {
    public async provideImplementation(document: TextDocument, position: Position, token: CancellationToken): Promise<Definition> {
        const request = <FindImplementationsRequest>createRequest(document, position);

        const implementations = await serverUtils.findImplementations(this._server, request, token).then(response => {
            if (!response || !response.QuickFixes) {
                return;
            }

            return response.QuickFixes.map(fix => toLocation(fix));
        }).catch();

        // Allow language middlewares to re-map its edits if necessary.
        try {
            const languageMiddlewares = this._languageMiddlewareFeature.getLanguageMiddlewares();
            let locations = implementations;
            for (const middleware of languageMiddlewares) {
                if (!middleware.remapLocations) {
                    continue;
                }

                const result = await middleware.remapLocations(locations, token);
                if (result) {
                    locations = result;
                }
            }

            return locations;
        }
        catch (error) {
            // Something happened while remapping locations. Return the original set of locations.
            return implementations;
        }
    }
}

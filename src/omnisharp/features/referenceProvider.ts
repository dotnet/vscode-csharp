/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as protocol from '../protocol';
import * as serverUtils from '../utils';
import { createRequest, toLocation, toLocationFromUri } from '../typeConversion';
import { ReferenceProvider, Location, TextDocument, CancellationToken, Position } from 'vscode';
import { OmniSharpServer } from '../server';
import { LanguageMiddlewareFeature } from '../languageMiddlewareFeature';
import SourceGeneratedDocumentProvider from './sourceGeneratedDocumentProvider';

export default class OmniSharpReferenceProvider extends AbstractSupport implements ReferenceProvider {
    public constructor(
        server: OmniSharpServer,
        languageMiddlewareFeature: LanguageMiddlewareFeature,
        private generatedDocumentProvider: SourceGeneratedDocumentProvider
    ) {
        super(server, languageMiddlewareFeature);
    }

    public async provideReferences(
        document: TextDocument,
        position: Position,
        options: { includeDeclaration: boolean },
        token: CancellationToken
    ): Promise<Location[]> {
        const req = createRequest<protocol.FindUsagesRequest>(document, position);
        req.OnlyThisFile = false;
        req.ExcludeDefinition = true;

        try {
            const res = await serverUtils.findUsages(this._server, req, token);
            if (res && Array.isArray(res.QuickFixes)) {
                const references = res.QuickFixes.map((l) => this.mapToLocationWithGeneratedInfoPopulation(l));

                // Allow language middlewares to re-map its edits if necessary.
                const result = await this._languageMiddlewareFeature.remap('remapLocations', references, token);
                return result;
            }
        } catch {
            /* empty */
        }

        return [];
    }

    private mapToLocationWithGeneratedInfoPopulation(symbolLocation: protocol.SymbolLocation): Location {
        if (symbolLocation.GeneratedFileInfo) {
            const uri = this.generatedDocumentProvider.addSourceGeneratedFileWithoutInitialContent(
                symbolLocation.GeneratedFileInfo,
                symbolLocation.FileName
            );
            return toLocationFromUri(uri, symbolLocation);
        }

        return toLocation(symbolLocation);
    }
}

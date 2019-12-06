/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as serverUtils from '../omnisharp/utils';
import { CancellationToken, DefinitionProvider, Location, Position, TextDocument, Uri } from 'vscode';
import { GoToDefinitionRequest, MetadataRequest, MetadataSource } from '../omnisharp/protocol';
import { createRequest, toLocation, toLocationFromUri } from '../omnisharp/typeConversion';
import AbstractSupport from './abstractProvider';
import DefinitionMetadataDocumentProvider from './definitionMetadataDocumentProvider';
import { OmniSharpServer } from '../omnisharp/server';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';

export default class CSharpDefinitionProvider extends AbstractSupport implements DefinitionProvider {
    private _definitionMetadataDocumentProvider: DefinitionMetadataDocumentProvider;

    constructor(server: OmniSharpServer, definitionMetadataDocumentProvider: DefinitionMetadataDocumentProvider, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);

        this._definitionMetadataDocumentProvider = definitionMetadataDocumentProvider;
    }

    public async provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Location> {

        let req = <GoToDefinitionRequest>createRequest(document, position);
        req.WantMetadata = true;

        let location: Location;
        try {
            let gotoDefinitionResponse = await serverUtils.goToDefinition(this._server, req, token);
            // the defintion is in source
            if (gotoDefinitionResponse && gotoDefinitionResponse.FileName) {

                // if it is part of an already used metadata file, retrieve its uri instead of going to the physical file
                if (gotoDefinitionResponse.FileName.startsWith("$metadata$")) {
                    const uri = this._definitionMetadataDocumentProvider.getExistingMetadataResponseUri(gotoDefinitionResponse.FileName);
                    location = toLocationFromUri(uri, gotoDefinitionResponse);
                } else {
                    // if it is a normal source definition, convert the response to a location
                    location = toLocation(gotoDefinitionResponse);
                }

                // the definition is in metadata
            } else if (gotoDefinitionResponse.MetadataSource) {
                const metadataSource: MetadataSource = gotoDefinitionResponse.MetadataSource;

                // go to metadata endpoint for more information
                serverUtils.getMetadata(this._server, <MetadataRequest>{
                    Timeout: 5000,
                    AssemblyName: metadataSource.AssemblyName,
                    VersionNumber: metadataSource.VersionNumber,
                    ProjectName: metadataSource.ProjectName,
                    Language: metadataSource.Language,
                    TypeName: metadataSource.TypeName
                }).then(metadataResponse => {
                    if (!metadataResponse || !metadataResponse.Source || !metadataResponse.SourceName) {
                        return;
                    }

                    const uri: Uri = this._definitionMetadataDocumentProvider.addMetadataResponse(metadataResponse);
                    location = new Location(uri, new Position(gotoDefinitionResponse.Line - 1, gotoDefinitionResponse.Column - 1));
                });
            }

            // Allow language middlewares to re-map its edits if necessary.
            const result = await this._languageMiddlewareFeature.remap("remapLocations", [location], token);
            if (result && result.length == 1) {
                return result[0];
            }

            return location;
        }
        catch (error) {
            return;
        }
    }
}

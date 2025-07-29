/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as serverUtils from '../utils';
import {
    CancellationToken,
    TypeDefinitionProvider,
    DefinitionProvider,
    Location,
    Position,
    TextDocument,
    Uri,
} from 'vscode';
import {
    GoToTypeDefinitionRequest,
    GoToTypeDefinitionResponse,
    MetadataRequest,
    MetadataSource,
    V2,
} from '../protocol';
import { createRequest, toRange3, toVscodeLocation } from '../typeConversion';
import AbstractSupport from './abstractProvider';
import DefinitionMetadataOrSourceGeneratedDocumentProvider from './definitionMetadataDocumentProvider';
import { OmniSharpServer } from '../server';
import { LanguageMiddlewareFeature } from '../languageMiddlewareFeature';
import SourceGeneratedDocumentProvider from './sourceGeneratedDocumentProvider';

export default class OmniSharpDefinitionProvider
    extends AbstractSupport
    implements DefinitionProvider, TypeDefinitionProvider
{
    constructor(
        server: OmniSharpServer,
        private definitionMetadataDocumentProvider: DefinitionMetadataOrSourceGeneratedDocumentProvider,
        private sourceGeneratedDocumentProvider: SourceGeneratedDocumentProvider,
        languageMiddlewareFeature: LanguageMiddlewareFeature
    ) {
        super(server, languageMiddlewareFeature);
    }

    public async provideDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken
    ): Promise<Location[]> {
        const req = <V2.GoToDefinitionRequest>createRequest(document, position);
        req.WantMetadata = true;

        try {
            const gotoDefinitionResponse = await serverUtils.goToDefinition(this._server, req, token);
            return await this.GetLocationsFromResponse(gotoDefinitionResponse, token);
        } catch (_) {
            return [];
        }
    }

    public async provideTypeDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken
    ): Promise<Location[]> {
        const req = <GoToTypeDefinitionRequest>createRequest(document, position);
        req.WantMetadata = true;

        try {
            const goToTypeDefinitionResponse = await serverUtils.goToTypeDefinition(this._server, req, token);
            return await this.GetLocationsFromResponse(goToTypeDefinitionResponse, token);
        } catch (_) {
            return [];
        }
    }

    private async GetLocationsFromResponse(
        response: GoToTypeDefinitionResponse | V2.GoToDefinitionResponse,
        token: CancellationToken
    ): Promise<Location[]> {
        const locations: Location[] = [];
        if (response && response.Definitions) {
            for (const definition of response.Definitions) {
                if (definition.MetadataSource) {
                    // the definition is in metadata
                    const metadataSource: MetadataSource = definition.MetadataSource;

                    // Do we already have a document for this metadata reference?
                    if (
                        definition.Location.FileName.startsWith('$metadata$') &&
                        this.definitionMetadataDocumentProvider.hasMetadataDocument(definition.Location.FileName)
                    ) {
                        // if it is part of an already used metadata file, retrieve its uri instead of going to the physical file
                        const uri = this.definitionMetadataDocumentProvider.getExistingMetadataResponseUri(
                            definition.Location.FileName
                        );
                        const vscodeRange = toRange3(definition.Location.Range);
                        locations.push(new Location(uri, vscodeRange));
                        continue;
                    }

                    // We need to go to the metadata endpoint for more information
                    const metadataResponse = await serverUtils.getMetadata(this._server, <MetadataRequest>{
                        Timeout: 5000,
                        AssemblyName: metadataSource.AssemblyName,
                        VersionNumber: metadataSource.VersionNumber,
                        ProjectName: metadataSource.ProjectName,
                        Language: metadataSource.Language,
                        TypeName: metadataSource.TypeName,
                    });

                    if (!metadataResponse || !metadataResponse.Source || !metadataResponse.SourceName) {
                        continue;
                    }

                    const uri: Uri = this.definitionMetadataDocumentProvider.addMetadataResponse(metadataResponse);
                    const vscodeRange = toRange3(definition.Location.Range);
                    locations.push(new Location(uri, vscodeRange));
                } else if (definition.SourceGeneratedFileInfo) {
                    // File is source generated
                    const uri = this.sourceGeneratedDocumentProvider.addSourceGeneratedFileWithoutInitialContent(
                        definition.SourceGeneratedFileInfo,
                        definition.Location.FileName
                    );
                    locations.push(new Location(uri, toRange3(definition.Location.Range)));
                } else {
                    // if it is a normal source definition, convert the response to a location
                    locations.push(toVscodeLocation(definition.Location));
                }
            }
        }
        // Allow language middlewares to re-map its edits if necessary.
        return await this._languageMiddlewareFeature.remap('remapLocations', locations, token);
    }
}

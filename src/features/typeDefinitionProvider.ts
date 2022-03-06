/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as serverUtils from '../omnisharp/utils';
import { CancellationToken, TypeDefinitionProvider, Location, Position, TextDocument, Uri } from 'vscode';
import { MetadataRequest, MetadataSource, GoToTypeDefinitionRequest, } from '../omnisharp/protocol';
import { createRequest, toRange3, toVscodeLocation } from '../omnisharp/typeConversion';
import AbstractSupport from './abstractProvider';
import DefinitionMetadataOrSourceGeneratedDocumentProvider from './definitionMetadataDocumentProvider';
import { OmniSharpServer } from '../omnisharp/server';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';
import SourceGeneratedDocumentProvider from './sourceGeneratedDocumentProvider';

export default class CSharpTypeDefinitionProvider extends AbstractSupport implements TypeDefinitionProvider {
    constructor(
        server: OmniSharpServer,
        private definitionMetadataDocumentProvider: DefinitionMetadataOrSourceGeneratedDocumentProvider,
        private sourceGeneratedDocumentProvider: SourceGeneratedDocumentProvider,
        languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
    }

    public async provideTypeDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Location[]> {

        let req = <GoToTypeDefinitionRequest>createRequest(document, position);
        req.WantMetadata = true;

        const locations: Location[] = [];
        try {
            const goToTypeDefinitionResponse = await serverUtils.goToTypeDefinition(this._server, req, token);
            // the defintion is in source
            if (goToTypeDefinitionResponse && goToTypeDefinitionResponse.Definitions) {

                for (const definition of goToTypeDefinitionResponse.Definitions) {
                    if (definition.MetadataSource) {
                        // the definition is in metadata
                        const metadataSource: MetadataSource = definition.MetadataSource;

                        // Do we already have a document for this metadata reference?
                        if (definition.Location.FileName.startsWith("$metadata$") &&
                            this.definitionMetadataDocumentProvider.hasMetadataDocument(definition.Location.FileName)) {

                            // if it is part of an already used metadata file, retrieve its uri instead of going to the physical file
                            const uri = this.definitionMetadataDocumentProvider.getExistingMetadataResponseUri(definition.Location.FileName);
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
                            TypeName: metadataSource.TypeName
                        });

                        if (!metadataResponse || !metadataResponse.Source || !metadataResponse.SourceName) {
                            continue;
                        }

                        const uri: Uri = this.definitionMetadataDocumentProvider.addMetadataResponse(metadataResponse);
                        const vscodeRange = toRange3(definition.Location.Range);
                        locations.push(new Location(uri, vscodeRange));
                    } else if (definition.SourceGeneratedFileInfo) {
                        // File is source generated
                        let uri = this.sourceGeneratedDocumentProvider.tryGetExistingSourceGeneratedFile(definition.SourceGeneratedFileInfo);
                        if (!uri) {
                            const sourceGeneratedFileResponse = await serverUtils.getSourceGeneratedFile(this._server, definition.SourceGeneratedFileInfo, token);

                            if (!sourceGeneratedFileResponse || !sourceGeneratedFileResponse.Source || !sourceGeneratedFileResponse.SourceName) {
                                continue;
                            }

                            uri = this.sourceGeneratedDocumentProvider.addSourceGeneratedFile(definition.SourceGeneratedFileInfo, sourceGeneratedFileResponse);
                        }

                        locations.push(new Location(uri, toRange3(definition.Location.Range)));
                    } else {
                        // if it is a normal source definition, convert the response to a location
                        locations.push(toVscodeLocation(definition.Location));
                    }
                }
            }

            // Allow language middlewares to re-map its edits if necessary.
            const result = await this._languageMiddlewareFeature.remap("remapLocations", locations, token);
            return result;
        }
        catch (error) {
            return [];
        }
    }
}

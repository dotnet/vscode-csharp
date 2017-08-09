/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import {MetadataRequest, GoToDefinitionRequest, MetadataSource} from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import {createRequest, toLocation} from '../omnisharp/typeConvertion';
import {Uri, TextDocument, Position, Location, CancellationToken, DefinitionProvider} from 'vscode';
import DefinitionMetadataDocumentProvider from './definitionMetadataDocumentProvider';
import TelemetryReporter from 'vscode-extension-telemetry';

export default class CSharpDefinitionProvider extends AbstractSupport implements DefinitionProvider {
    private _definitionMetadataDocumentProvider: DefinitionMetadataDocumentProvider;

    constructor(server,reporter: TelemetryReporter, definitionMetadataDocumentProvider: DefinitionMetadataDocumentProvider) {
        super(server, reporter);

        this._definitionMetadataDocumentProvider = definitionMetadataDocumentProvider;
    }

    public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Location> {

        let req = <GoToDefinitionRequest>createRequest(document, position);
        req.WantMetadata = true;

        return serverUtils.goToDefinition(this._server, req, token).then(gotoDefinitionResponse => {

            if (gotoDefinitionResponse && gotoDefinitionResponse.FileName) {
                return toLocation(gotoDefinitionResponse);
            } else if (gotoDefinitionResponse.MetadataSource) {
                const metadataSource: MetadataSource = gotoDefinitionResponse.MetadataSource;

                return serverUtils.getMetadata(this._server, <MetadataRequest> {
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
                    return new Location(uri, new Position(gotoDefinitionResponse.Line - 1, gotoDefinitionResponse.Column - 1));
                });
            }
        });
    }
}

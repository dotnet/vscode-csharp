/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import {MetadataRequest, GoToDefinitionRequest} from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import {createRequest, toLocation} from '../omnisharp/typeConvertion';
import {workspace, window, Uri, TextDocument, Position, Location, CancellationToken, DefinitionProvider, Selection, TextEditorRevealType} from 'vscode';

export default class CSharpDefinitionProvider extends AbstractSupport implements DefinitionProvider {

	public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Location> {

		let req = <GoToDefinitionRequest>createRequest(document, position);
        req.WantMetadata = true;

		return serverUtils.goToDefinition(this._server, req, token).then(value => {

			if (value && value.FileName) {
				return toLocation(value);
			} else if (value.MetadataSource) {

                let lineNumber = value.Line;
                let column = value.Column;

                serverUtils.getMetadata(this._server, <MetadataRequest> {
                    AssemblyName: value.MetadataSource.AssemblyName,
                    VersionNumber: value.MetadataSource.VersionNumber,
                    ProjectName: value.MetadataSource.ProjectName,
                    Language: value.MetadataSource.Language,
                    TypeName: value.MetadataSource.TypeName
                }).then(metadataResponse => {
                    if (!metadataResponse || !metadataResponse.Source || !metadataResponse.SourceName) {
                        return;
                    }

                    const scheme = "omnisharp-metadata";
                    let temporaryDocumentContentProviderRegistration = workspace.registerTextDocumentContentProvider(scheme, {
                        provideTextDocumentContent: function(uri) {
                            return metadataResponse.Source;
                        }
                    });

                    let uri = Uri.parse(scheme + "://" + metadataResponse.SourceName.replace(/\\/g, "/").replace(/(.*)\/(.*)/g, "$1/[metadata] $2"));
                    workspace.openTextDocument(uri).then(document => {
                        temporaryDocumentContentProviderRegistration.dispose();

                        window.showTextDocument(document, null, false).then(editor => {
                            let position = new Position(lineNumber - 1, column - 1);
                            editor.selection = new Selection(position, position);
                            editor.revealRange(editor.document.lineAt(position.line).range, TextEditorRevealType.InCenter);
                        });
                    });
                });
            }
		});
	}
}

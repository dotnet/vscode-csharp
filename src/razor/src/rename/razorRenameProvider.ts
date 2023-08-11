/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { RazorDocumentSynchronizer } from '../document/razorDocumentSynchronizer';
import { RazorLanguageFeatureBase } from '../razorLanguageFeatureBase';
import { RazorLanguageServiceClient } from '../razorLanguageServiceClient';
import { RazorLogger } from '../razorLogger';
import { LanguageKind } from '../rpc/languageKind';
import { MappingHelpers } from '../mapping/mappingHelpers';

export class RazorRenameProvider extends RazorLanguageFeatureBase implements vscode.RenameProvider {
    constructor(
        documentSynchronizer: RazorDocumentSynchronizer,
        documentManager: RazorDocumentManager,
        serviceClient: RazorLanguageServiceClient,
        logger: RazorLogger
    ) {
        super(documentSynchronizer, documentManager, serviceClient, logger);
    }

    public async prepareRename(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ) {
        const projection = await this.getProjection(document, position, token);
        if (!projection || projection.languageKind !== LanguageKind.CSharp) {
            // We only support C# renames for now. Reject the rename request.
            // Originally we rejected here. However due to how the language
            // server client currently works, if we reject here it prevents
            // other servers from being able to return a response instead.
            // Null is the only return that allows us to handle renaming
            // from the Razor language server.
            return null; // Promise.reject(l10n.t('Cannot rename this symbol.'));
        }

        const range = document.getWordRangeAtPosition(position);
        return range;
    }

    public async provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string,
        token: vscode.CancellationToken
    ) {
        const projection = await this.getProjection(document, position, token);
        if (!projection) {
            return;
        }

        if (projection.languageKind !== LanguageKind.CSharp) {
            // We only support C# renames for now.
            return;
        }

        const response = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
            'vscode.executeDocumentRenameProvider',
            projection.uri,
            projection.position,
            newName
        );

        // Re-map the rename location to the original Razor document
        const remappedResponse = await MappingHelpers.remapGeneratedFileWorkspaceEdit(
            response,
            this.serviceClient,
            this.logger,
            token
        );
        return remappedResponse;
    }
}

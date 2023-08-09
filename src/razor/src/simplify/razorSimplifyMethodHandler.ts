/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType, TextDocumentIdentifier } from 'vscode-languageclient';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { UriConverter } from '../../../lsptoolshost/uriConverter';
import { RazorLanguageServiceClient } from '../razorLanguageServiceClient';
import { RazorLanguageFeatureBase } from '../razorLanguageFeatureBase';
import { RazorDocumentSynchronizer } from '../document/razorDocumentSynchronizer';
import { RazorLogger } from '../razorLogger';
import { SerializableDelegatedSimplifyMethodParams } from './serializableDelegatedSimplifyMethodParams';
import { RoslynLanguageServer } from '../../../lsptoolshost/roslynLanguageServer';
import SerializableSimplifyMethodParams from './serializableSimplifyMethodParams';
import { TextEdit } from 'vscode-html-languageservice';

export class RazorSimplifyMethodHandler extends RazorLanguageFeatureBase {
    private static readonly razorSimplifyMethodCommand = 'razor/simplifyMethod';
    private simplifyTypeNamesRequestType: RequestType<SerializableDelegatedSimplifyMethodParams, TextEdit[], any> =
        new RequestType(RazorSimplifyMethodHandler.razorSimplifyMethodCommand);

    constructor(
        documentSynchronizer: RazorDocumentSynchronizer,
        protected readonly serverClient: RazorLanguageServerClient,
        protected readonly serviceClient: RazorLanguageServiceClient,
        protected readonly documentManager: RazorDocumentManager,
        protected readonly logger: RazorLogger
    ) {
        super(documentSynchronizer, documentManager, serviceClient, logger);
    }

    public async register() {
        await this.serverClient.onRequestWithParams<
            SerializableDelegatedSimplifyMethodParams,
            TextEdit[] | undefined,
            any
        >(
            this.simplifyTypeNamesRequestType,
            async (request: SerializableDelegatedSimplifyMethodParams, token: vscode.CancellationToken) =>
                this.getSimplifiedTypeNames(request, token)
        );
    }

    private async getSimplifiedTypeNames(
        request: SerializableDelegatedSimplifyMethodParams,
        _: vscode.CancellationToken
    ): Promise<TextEdit[] | undefined> {
        if (!this.documentManager.roslynActivated) {
            return undefined;
        }

        let identifier = request.identifier.textDocumentIdentifier;
        if (request.requiresVirtualDocument) {
            const razorDocumentUri = vscode.Uri.parse(request.identifier.textDocumentIdentifier.uri, true);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            const virtualCSharpUri = razorDocument.csharpDocument.uri;
            identifier = TextDocumentIdentifier.create(UriConverter.serialize(virtualCSharpUri));
        }

        const params = new SerializableSimplifyMethodParams(identifier, request.textEdit);
        const response: TextEdit[] | undefined = await vscode.commands.executeCommand(
            RoslynLanguageServer.roslynSimplifyMethodCommand,
            params
        );

        return response;
    }
}

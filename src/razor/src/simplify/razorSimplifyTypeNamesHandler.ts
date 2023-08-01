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
import { SerializableDelegatedSimplifyTypeNamesParams } from './serializableDelegatedSimplifyTypeNamesParams';
import { RoslynLanguageServer } from '../../../lsptoolshost/roslynLanguageServer';
import SerializableSimplifyTypeNamesParams from './serializableSimplifyTypeNamesParams';

export class RazorSimplifyTypeNamesHandler extends RazorLanguageFeatureBase {
    private static readonly razorSimplifyTypeNamesCommand = 'razor/simplifyTypeNames';
    private simplifyTypeNamesRequestType: RequestType<SerializableDelegatedSimplifyTypeNamesParams, string[], any> =
        new RequestType(RazorSimplifyTypeNamesHandler.razorSimplifyTypeNamesCommand);

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
            SerializableDelegatedSimplifyTypeNamesParams,
            string[] | undefined,
            any
        >(
            this.simplifyTypeNamesRequestType,
            async (request: SerializableDelegatedSimplifyTypeNamesParams, token: vscode.CancellationToken) =>
                this.getSimplifiedTypeNames(request, token)
        );
    }

    private async getSimplifiedTypeNames(
        request: SerializableDelegatedSimplifyTypeNamesParams,
        _: vscode.CancellationToken
    ): Promise<string[] | undefined> {
        if (!this.documentManager.roslynActivated) {
            return undefined;
        }

        const razorDocumentUri = vscode.Uri.parse(request.identifier.textDocumentIdentifier.uri, true);
        const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
        const virtualCSharpUri = razorDocument.csharpDocument.uri;
        const params = new SerializableSimplifyTypeNamesParams(
            TextDocumentIdentifier.create(UriConverter.serialize(virtualCSharpUri)),
            request.codeBehindIdentifier,
            request.fullyQualifiedTypeNames,
            request.absoluteIndex
        );
        const response: string[] | undefined = await vscode.commands.executeCommand(
            RoslynLanguageServer.roslynSimplifyTypeNamesCommand,
            params
        );

        return response;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DocumentDiagnosticParams, DocumentDiagnosticReport, RequestType } from 'vscode-languageserver-protocol';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { UriConverter } from '../../../lsptoolshost/utils/uriConverter';
import { RazorLanguageServiceClient } from '../razorLanguageServiceClient';
import { RazorLanguageFeatureBase } from '../razorLanguageFeatureBase';
import { RazorDocumentSynchronizer } from '../document/razorDocumentSynchronizer';
import { RazorLogger } from '../razorLogger';
import { roslynPullDiagnosticCommand } from '../../../lsptoolshost/razor/razorCommands';
import { SerializableTextDocumentIdentifierAndVersion } from '../simplify/serializableTextDocumentIdentifierAndVersion';

export class RazorDiagnosticHandler extends RazorLanguageFeatureBase {
    private static readonly razorPullDiagnosticsCommand = 'razor/csharpPullDiagnostics';
    private diagnosticRequestType: RequestType<DelegatedDiagnosticParams, DocumentDiagnosticReport, any> =
        new RequestType(RazorDiagnosticHandler.razorPullDiagnosticsCommand);

    constructor(
        protected readonly documentSynchronizer: RazorDocumentSynchronizer,
        protected readonly serverClient: RazorLanguageServerClient,
        protected readonly serviceClient: RazorLanguageServiceClient,
        protected readonly documentManager: RazorDocumentManager,
        protected readonly logger: RazorLogger
    ) {
        super(documentSynchronizer, documentManager, serviceClient, logger);
    }

    public async register() {
        await this.serverClient.onRequestWithParams<
            DelegatedDiagnosticParams,
            DocumentDiagnosticReport | undefined,
            any
        >(this.diagnosticRequestType, async (request: DelegatedDiagnosticParams, token: vscode.CancellationToken) =>
            this.getDiagnostic(request, token)
        );
    }

    private async getDiagnostic(
        request: DelegatedDiagnosticParams,
        token: vscode.CancellationToken
    ): Promise<DocumentDiagnosticReport | undefined> {
        if (!this.documentManager.roslynActivated) {
            return undefined;
        }

        const razorDocumentUri = vscode.Uri.parse(request.identifier.textDocumentIdentifier.uri, true);
        const textDocument = await vscode.workspace.openTextDocument(razorDocumentUri);
        const razorDocument = await this.documentManager.getDocument(razorDocumentUri);

        const synchronized = await this.documentSynchronizer.trySynchronizeProjectedDocument(
            textDocument,
            razorDocument.csharpDocument,
            request.identifier.version,
            token
        );

        if (!synchronized) {
            return undefined;
        }

        const virtualCSharpUri = razorDocument.csharpDocument.uri;

        const roslynRequest: DocumentDiagnosticParams = {
            textDocument: {
                uri: UriConverter.serialize(virtualCSharpUri),
            },
        };

        const response: DocumentDiagnosticReport = await vscode.commands.executeCommand(
            roslynPullDiagnosticCommand,
            roslynRequest
        );

        return response;
    }
}

interface DelegatedDiagnosticParams {
    identifier: SerializableTextDocumentIdentifierAndVersion;
    correlationId: string;
}

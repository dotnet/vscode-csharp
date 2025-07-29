/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DocumentDiagnosticReport, DocumentDiagnosticParams, RequestType } from 'vscode-languageclient';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { UriConverter } from '../../../lsptoolshost/utils/uriConverter';
import { RazorLanguageServiceClient } from '../razorLanguageServiceClient';
import { RazorLanguageFeatureBase } from '../razorLanguageFeatureBase';
import { RazorDocumentSynchronizer } from '../document/razorDocumentSynchronizer';
import { RazorLogger } from '../razorLogger';
import { roslynPullDiagnosticCommand } from '../../../lsptoolshost/razor/razorCommands';

export class RazorDiagnosticHandler extends RazorLanguageFeatureBase {
    private static readonly razorPullDiagnosticsCommand = 'razor/csharpPullDiagnostics';
    private diagnosticRequestType: RequestType<DocumentDiagnosticParams, DocumentDiagnosticReport, any> =
        new RequestType(RazorDiagnosticHandler.razorPullDiagnosticsCommand);

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
            DocumentDiagnosticParams,
            DocumentDiagnosticReport | undefined,
            any
        >(this.diagnosticRequestType, async (request: DocumentDiagnosticParams, token: vscode.CancellationToken) =>
            this.getDiagnostic(request, token)
        );
    }

    private async getDiagnostic(
        request: DocumentDiagnosticParams,
        _: vscode.CancellationToken
    ): Promise<DocumentDiagnosticReport | undefined> {
        if (!this.documentManager.roslynActivated) {
            return undefined;
        }

        const razorDocumentUri = vscode.Uri.parse(request.textDocument.uri, true);
        const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
        const virtualCSharpUri = razorDocument.csharpDocument.uri;
        request.textDocument.uri = UriConverter.serialize(virtualCSharpUri);
        const response: DocumentDiagnosticReport = await vscode.commands.executeCommand(
            roslynPullDiagnosticCommand,
            request
        );

        return response;
    }
}

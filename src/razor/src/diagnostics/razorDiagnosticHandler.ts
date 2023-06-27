/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as vscode from 'vscode';
import { DocumentDiagnosticReport, DocumentDiagnosticParams, RequestType, FullDocumentDiagnosticReport, Range, Diagnostic } from 'vscode-languageclient';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { RoslynLanguageServer } from '../../../lsptoolshost/roslynLanguageServer';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { UriConverter } from '../../../lsptoolshost/uriConverter';
import { LanguageKind } from '../rpc/languageKind';
import { RazorLanguageServiceClient } from '../razorLanguageServiceClient';
import { RazorLanguageFeatureBase } from '../razorLanguageFeatureBase';
import { RazorDocumentSynchronizer } from '../document/razorDocumentSynchronizer';
import { RazorLogger } from '../razorLogger';

export class RazorDiagnosticHandler extends RazorLanguageFeatureBase {
    private static readonly razorPullDiagnosticsCommand = 'razor/pullDiagnostics';
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
        await this.serverClient.onRequestWithParams<DocumentDiagnosticParams, DocumentDiagnosticReport | undefined, any>(
            this.diagnosticRequestType,
            async (request: DocumentDiagnosticParams, token: vscode.CancellationToken) => this.getDiagnostic(request, token));
    }

    private async getDiagnostic(request: DocumentDiagnosticParams, _: vscode.CancellationToken): Promise<DocumentDiagnosticReport | undefined> {
        if (!this.documentManager.roslynActivated) {
            return undefined;
        }

        const razorDocumentUri = vscode.Uri.parse(request.textDocument.uri, true);
        const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
        const virtualCSharpUri = razorDocument.csharpDocument.uri;
        request.textDocument.uri = UriConverter.serialize(virtualCSharpUri);
        const response: DocumentDiagnosticReport = await vscode.commands.executeCommand(RoslynLanguageServer.roslynPullDiagnosticCommand, request);
        if (response.kind === "full") {
            const changedDiagnostics: FullDocumentDiagnosticReport = response as FullDocumentDiagnosticReport;
            const remappedDiagnostics = new Array<Diagnostic>();
            for (const diagnostic of changedDiagnostics.items) {
                const convertedRange = new vscode.Range(diagnostic.range.start.line, diagnostic.range.start.character, diagnostic.range.end.line, diagnostic.range.end.character);
                const remappedResponse = await this.serviceClient.mapToDocumentRanges(
                    LanguageKind.CSharp,
                    [convertedRange],
                    razorDocument.uri);
                if (remappedResponse.ranges.length != 0) {
                    diagnostic.range = Range.create(remappedResponse.ranges[0].start, remappedResponse.ranges[0].end);
                    remappedDiagnostics.push(diagnostic);
                }
            }
            changedDiagnostics.items = remappedDiagnostics;
        }

        return response;
    }
}

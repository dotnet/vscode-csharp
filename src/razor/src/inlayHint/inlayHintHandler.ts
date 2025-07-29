/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { InlayHint, InlayHintParams, RequestType, TextDocumentIdentifier } from 'vscode-languageserver-protocol';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { RazorLogger } from '../razorLogger';
import { SerializableInlayHintParams } from './serializableInlayHintParams';
import { provideInlayHintsCommand } from '../../../lsptoolshost/razor/razorCommands';
import { UriConverter } from '../../../lsptoolshost/utils/uriConverter';
import { RazorDocumentSynchronizer } from '../document/razorDocumentSynchronizer';

export class InlayHintHandler {
    private static readonly provideInlayHint = 'razor/inlayHint';
    private InlayHintRequestType: RequestType<SerializableInlayHintParams, InlayHint[], any> = new RequestType(
        InlayHintHandler.provideInlayHint
    );
    private emptyInlayHintResponse = new Array<InlayHint>();

    constructor(
        private readonly serverClient: RazorLanguageServerClient,
        private readonly documentManager: RazorDocumentManager,
        private readonly documentSynchronizer: RazorDocumentSynchronizer,
        private readonly logger: RazorLogger
    ) {}

    public async register() {
        await this.serverClient.onRequestWithParams<SerializableInlayHintParams, InlayHint[], any>(
            this.InlayHintRequestType,
            async (request, token) => this.provideInlayHints(request, token)
        );
    }

    private async provideInlayHints(inlayHintParams: SerializableInlayHintParams, token: vscode.CancellationToken) {
        try {
            const razorDocumentUri = vscode.Uri.parse(inlayHintParams.identifier.textDocumentIdentifier.uri, true);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                return this.emptyInlayHintResponse;
            }

            if (!this.documentManager.roslynActivated) {
                // Unlike most other handlers, inlay hints works by directly sending an LSP request to Roslyn, so if Roslyn isn't
                // activated we need to catch that here.
                return this.emptyInlayHintResponse;
            }

            const textDocument = await vscode.workspace.openTextDocument(razorDocumentUri);
            const synchronized = await this.documentSynchronizer.trySynchronizeProjectedDocument(
                textDocument,
                razorDocument.csharpDocument,
                inlayHintParams.identifier.version,
                token
            );
            if (!synchronized) {
                return this.emptyInlayHintResponse;
            }

            const virtualCSharpUri = UriConverter.serialize(razorDocument.csharpDocument.uri);

            const roslynInlayHintParams = <InlayHintParams>{
                textDocument: TextDocumentIdentifier.create(virtualCSharpUri),
                range: inlayHintParams.projectedRange,
            };
            const csharpInlayHints = await vscode.commands.executeCommand<InlayHint[]>(
                provideInlayHintsCommand,
                roslynInlayHintParams
            );

            return csharpInlayHints;
        } catch (error) {
            this.logger.logWarning(`${InlayHintHandler.provideInlayHint} failed with ${error}`);
        }

        return this.emptyInlayHintResponse;
    }
}

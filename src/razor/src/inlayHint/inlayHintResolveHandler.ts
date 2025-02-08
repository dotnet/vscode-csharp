/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { InlayHint, RequestType } from 'vscode-languageclient';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { RazorLogger } from '../razorLogger';
import { SerializableInlayHintResolveParams } from './serializableInlayHintResolveParams';
import { resolveInlayHintCommand } from '../../../lsptoolshost/razor/razorCommands';

export class InlayHintResolveHandler {
    private static readonly resolveInlayHint = 'razor/inlayHintResolve';
    private InlayHintResolveRequestType: RequestType<SerializableInlayHintResolveParams, InlayHint | null, any> =
        new RequestType(InlayHintResolveHandler.resolveInlayHint);

    constructor(
        private readonly serverClient: RazorLanguageServerClient,
        private readonly documentManager: RazorDocumentManager,
        private readonly logger: RazorLogger
    ) {}

    public async register() {
        await this.serverClient.onRequestWithParams<SerializableInlayHintResolveParams, InlayHint | null, any>(
            this.InlayHintResolveRequestType,
            async (request, token) => this.resolveInlayHint(request, token)
        );
    }

    private async resolveInlayHint(InlayHintParams: SerializableInlayHintResolveParams, _: vscode.CancellationToken) {
        try {
            const razorDocumentUri = vscode.Uri.parse(InlayHintParams.identifier.textDocumentIdentifier.uri, true);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                return null;
            }

            const response = await vscode.commands.executeCommand<InlayHint>(
                resolveInlayHintCommand,
                InlayHintParams.inlayHint
            );

            return response;
        } catch (error) {
            this.logger.logWarning(`${InlayHintResolveHandler.resolveInlayHint} failed with ${error}`);
        }

        return null;
    }
}

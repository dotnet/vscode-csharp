/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-jsonrpc';
import { RazorLanguageServerClient } from '../razorLanguageServerClient';
import { RazorDocumentManager } from '../document/razorDocumentManager';
import { RazorLanguageServiceClient } from '../razorLanguageServiceClient';
import { RazorLanguageFeatureBase } from '../razorLanguageFeatureBase';
import { RazorDocumentSynchronizer } from '../document/razorDocumentSynchronizer';
import { RazorLogger } from '../razorLogger';
import { SerializableFormatNewFileParams } from './serializableFormatNewFileParams';
import { roslynFormatNewFileCommand } from '../../../lsptoolshost/razor/razorCommands';

export class RazorFormatNewFileHandler extends RazorLanguageFeatureBase {
    private static readonly razorFormatNewFileCommand = 'razor/formatNewFile';
    private formatNewFileRequestType: RequestType<SerializableFormatNewFileParams, string | undefined, any> =
        new RequestType(RazorFormatNewFileHandler.razorFormatNewFileCommand);

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
        await this.serverClient.onRequestWithParams<SerializableFormatNewFileParams, string | undefined, any>(
            this.formatNewFileRequestType,
            async (request: SerializableFormatNewFileParams, token: vscode.CancellationToken) =>
                this.getFormatNewFile(request, token)
        );
    }

    private async getFormatNewFile(
        request: SerializableFormatNewFileParams,
        _: vscode.CancellationToken
    ): Promise<string | undefined> {
        if (!this.documentManager.roslynActivated) {
            return undefined;
        }

        const response: string | undefined = await vscode.commands.executeCommand(roslynFormatNewFileCommand, request);

        return response;
    }
}

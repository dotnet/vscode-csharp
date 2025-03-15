/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, LanguageClientOptions, MessageSignature } from 'vscode-languageclient';
import { LanguageClient, ServerOptions } from 'vscode-languageclient/node';
import { RazorLanguageServerOptions } from './razorLanguageServerOptions';

export class RazorLanguageClient extends LanguageClient {
    razorOptions: RazorLanguageServerOptions;

    constructor(
        id: string,
        name: string,
        serverOptions: ServerOptions,
        clientOptions: LanguageClientOptions,
        razorOptions: RazorLanguageServerOptions,
        forceDebug?: boolean
    ) {
        super(id, name, serverOptions, clientOptions, forceDebug);
        this.razorOptions = razorOptions;
    }

    override handleFailedRequest<T>(
        type: MessageSignature,
        token: CancellationToken | undefined,
        error: any,
        defaultValue: T,
        showNotification?: boolean
    ) {
        if (this.razorOptions.suppressErrorToasts) {
            return super.handleFailedRequest(type, token, error, defaultValue, false);
        }

        return super.handleFailedRequest(type, token, error, defaultValue, showNotification);
    }
}

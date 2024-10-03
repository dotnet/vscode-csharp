/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
    CancellationToken,
    LanguageClient,
    LanguageClientOptions,
    MessageSignature,
    ServerOptions,
} from 'vscode-languageclient/node';

export class RazorLanguageClient extends LanguageClient {
    constructor(
        id: string,
        name: string,
        serverOptions: ServerOptions,
        clientOptions: LanguageClientOptions,
        forceDebug?: boolean
    ) {
        super(id, name, serverOptions, clientOptions, forceDebug);
    }

    override handleFailedRequest<T>(
        type: MessageSignature,
        token: CancellationToken | undefined,
        error: any,
        defaultValue: T,
        _showNotification?: boolean
    ) {
        // Temporarily suppress toasts until co-hosting. This resolves some
        // underlying issues like the below list. This should be re-enabled when we have
        // confidence that users are receiving actionable errors from the language server.
        // https://github.com/microsoft/vscode-dotnettools/issues/722
        // https://github.com/dotnet/vscode-csharp/issues/6973
        // https://github.com/microsoft/vscode-languageserver-node/issues/1449
        return super.handleFailedRequest(type, token, error, defaultValue, false);
    }
}

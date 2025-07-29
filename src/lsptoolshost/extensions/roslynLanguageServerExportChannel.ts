/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { RequestType } from 'vscode-jsonrpc';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { PartialResultParams, ProtocolRequestType } from 'vscode-languageserver-protocol';

export class RoslynLanguageServerExport {
    constructor(private _serverInitialized: Promise<RoslynLanguageServer>) {}

    public async sendRequest<Params, Response, Error>(
        type: RequestType<Params, Response, Error>,
        params: Params,
        token: vscode.CancellationToken
    ): Promise<Response> {
        const server = await this._serverInitialized;
        // We need to recreate the type parameter to ensure that the prototypes line up. The `RequestType` we receive could have been
        // from a different version.
        const newType = new RequestType<Params, Response, Error>(type.method);
        return await server.sendRequest(newType, params, token);
    }

    public async sendRequestWithProgress<
        Params extends PartialResultParams,
        Response,
        PartialResult,
        Error,
        RegistrationOptions
    >(
        type: ProtocolRequestType<Params, Response, PartialResult, Error, RegistrationOptions>,
        params: Params,
        onProgress: (p: PartialResult) => Promise<any>,
        token?: vscode.CancellationToken
    ): Promise<Response> {
        const server = await this._serverInitialized;
        // We need to recreate the type parameter to ensure that the prototypes line up. The `ProtocolRequestType` we receive could have been
        // from a different version.
        const newType = new ProtocolRequestType<Params, Response, PartialResult, Error, RegistrationOptions>(
            type.method
        );
        return await server.sendRequestWithProgress(newType, params, onProgress, token);
    }
}

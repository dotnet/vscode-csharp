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
import CompositeDisposable from '../../compositeDisposable';
import { IDisposable } from '../../disposable';
import { languageServerOptions } from '../../shared/options';

/**
 * Implementation of the base LanguageClient type that allows for additional items to be disposed of
 * when the base LanguageClient instance is disposed.
 */
export class RoslynLanguageClient extends LanguageClient {
    private readonly _disposables: CompositeDisposable;

    constructor(
        id: string,
        name: string,
        serverOptions: ServerOptions,
        clientOptions: LanguageClientOptions,
        forceDebug?: boolean
    ) {
        super(id, name, serverOptions, clientOptions, forceDebug);

        this._disposables = new CompositeDisposable();
    }

    override async dispose(timeout?: number | undefined): Promise<void> {
        this._disposables.dispose();
        return super.dispose(timeout);
    }

    override handleFailedRequest<T>(
        type: MessageSignature,
        token: CancellationToken | undefined,
        error: any,
        defaultValue: T,
        showNotification?: boolean
    ) {
        // Temporarily allow LSP error toasts to be suppressed if configured.
        // There are a few architectural issues preventing us from solving some of the underlying problems,
        // for example Razor cohosting to fix text mismatch issues and unification of serialization libraries
        // to fix URI identification issues.  Once resolved, we should remove this option.
        //
        // See also https://github.com/microsoft/vscode-dotnettools/issues/722
        // https://github.com/dotnet/vscode-csharp/issues/6973
        // https://github.com/microsoft/vscode-languageserver-node/issues/1449
        if (languageServerOptions.suppressLspErrorToasts) {
            return super.handleFailedRequest(type, token, error, defaultValue, false);
        }
        return super.handleFailedRequest(type, token, error, defaultValue, showNotification);
    }

    /**
     * Adds a disposable that should be disposed of when the LanguageClient instance gets disposed.
     */
    public addDisposable(disposable: IDisposable) {
        this._disposables.add(disposable);
    }
}

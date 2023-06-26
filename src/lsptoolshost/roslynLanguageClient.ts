/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient/node";
import CompositeDisposable from "../compositeDisposable";
import { IDisposable } from "../disposable";

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
        forceDebug?: boolean) {
            super(id, name, serverOptions, clientOptions, forceDebug);

            this._disposables = new CompositeDisposable();
    }

    override async dispose(timeout?: number | undefined): Promise<void> {
        this._disposables.dispose();
        return super.dispose(timeout);
    }

    /**
     * Adds a disposable that should be disposed of when the LanguageClient instance gets disposed.
     */
    public addDisposable(disposable: IDisposable) {
        this._disposables.add(disposable);
    }
}
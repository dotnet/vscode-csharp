/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IDisposable } from '../Disposable';
import { LanguageMiddleware } from './LanguageMiddleware';

export class LanguageMiddlewareFeature implements IDisposable {
    private readonly _middlewares: LanguageMiddleware[];
    private _registration : IDisposable;

    constructor() {
        this._middlewares = [];
    }

    public dispose() : void {
        this._registration.dispose();
    }

    public register() : void {
        this._registration = vscode.commands.registerCommand(
            'omnisharp.registerLanguageMiddleware', (middleware: LanguageMiddleware) => {
                this._middlewares.push(middleware);
            });
    }

    public getLanguageMiddlewares(): LanguageMiddleware[] {
        return this._middlewares;
    }
}
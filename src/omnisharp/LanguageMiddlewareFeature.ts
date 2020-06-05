/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IDisposable } from '../Disposable';

export interface LanguageMiddleware extends RemapApi {
    language: string;
}

interface RemapApi {
    remapWorkspaceEdit?(workspaceEdit: vscode.WorkspaceEdit, token: vscode.CancellationToken): vscode.ProviderResult<vscode.WorkspaceEdit>;
    remapLocations?(locations: vscode.Location[], token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location[]>;
}

type GetRemapType<T extends (parameter: any, token: vscode.CancellationToken) => any>
    = T extends (parameter: infer R, token: vscode.CancellationToken) => vscode.ProviderResult<infer R> ? R : any;

type RemapParameterType<M extends keyof RemapApi> = GetRemapType<NonNullable<RemapApi[M]>>;

export class LanguageMiddlewareFeature implements IDisposable {
    private readonly _middlewares: LanguageMiddleware[];
    private _registration: IDisposable;

    constructor() {
        this._middlewares = [];
    }

    public dispose(): void {
        this._registration.dispose();
    }

    public register(): void {
        this._registration = vscode.commands.registerCommand(
            'omnisharp.registerLanguageMiddleware', (middleware: LanguageMiddleware) => {
                this._middlewares.push(middleware);
            });
    }

    public getLanguageMiddlewares(): LanguageMiddleware[] {
        return this._middlewares;
    }

    public async remap<M extends keyof RemapApi, P extends RemapParameterType<M>>(
        remapType: M, original: P, token: vscode.CancellationToken): Promise<P> {
        try {
            const languageMiddlewares = this.getLanguageMiddlewares();
            let remapped = original;

            for (const middleware of languageMiddlewares) {
                // Commit a type crime because we know better than the compiler
                const method = <(p: P, c: vscode.CancellationToken) => vscode.ProviderResult<P>>middleware[remapType];
                if (!method) {
                    continue;
                }

                const result = await method.call(middleware, remapped, token);
                if (result) {
                    remapped = result;
                }
            }

            return remapped;
        }
        catch (error) {
            // Something happened while remapping. Return the original.
            return original;
        }
    }
}
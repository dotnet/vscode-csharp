/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmniSharpServer } from '../server';
import CompositeDisposable from '../../compositeDisposable';
import { LanguageMiddlewareFeature } from '../languageMiddlewareFeature';

export default abstract class AbstractProvider {
    protected _server: OmniSharpServer;
    protected _languageMiddlewareFeature: LanguageMiddlewareFeature;
    private _disposables: CompositeDisposable;

    constructor(server: OmniSharpServer, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        this._server = server;
        this._languageMiddlewareFeature = languageMiddlewareFeature;
        this._disposables = new CompositeDisposable();
    }

    protected addDisposables(disposables: CompositeDisposable) {
        this._disposables.add(disposables);
    }

    dispose = () => {
        this._disposables.dispose();
    };
}

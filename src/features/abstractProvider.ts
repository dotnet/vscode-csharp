/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { OmniSharpServer } from '../omnisharp/server';
import { Disposable } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

export default class AbstractProvider {

    protected _server: OmniSharpServer;
    protected _reporter: TelemetryReporter;
    protected _disposables: Disposable[];

    constructor(server: OmniSharpServer, reporter: TelemetryReporter) {
        this._server = server;
        this._reporter = reporter;
        this._disposables = [];
    }

    dispose() {
        while (this._disposables.length) {
            this._disposables.pop().dispose();
        }
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../vscodeAdapter';
import * as ObservableEvent from "../omnisharp/loggingEvents";

export class ProjectStatusObserver {

    constructor() {
    }

    public post = (event: ObservableEvent.BaseEvent) => {
        switch (event.constructor.name) {
        }
    }
}
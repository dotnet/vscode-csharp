/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Message } from "../messageType";

export abstract class BaseLoggerObserver {
    public logger: LoggerAdapter;
    constructor(loggerCreator: () => LoggerAdapter) {
        this.logger = loggerCreator();
    }
    
    abstract onNext: (message: Message) => void;
}

export interface LoggerAdapter {
    appendLine: (message?: string) => void;
    append: (message?: string) => void;
    decreaseIndent: () => void;
    increaseIndent: () => void;
}
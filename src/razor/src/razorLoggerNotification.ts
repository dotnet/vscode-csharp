/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LogLevel } from 'vscode';

export class RazorLoggerNotification {
    constructor(public readonly message: string, public readonly level: LogLevel) {}
}

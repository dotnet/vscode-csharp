/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { SerializableRange } from '../RPC/SerializableRange';

export class SerializableColorInformation {
    constructor(
        public readonly range: SerializableRange,
        public readonly color: vscode.Color) {
    }
}

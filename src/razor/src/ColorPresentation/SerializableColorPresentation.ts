/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { SerializableTextEdit } from '../RPC/SerializableTextEdit';

export class SerializableColorPresentation {
    constructor(
        public readonly label: string,
        public readonly textEdit?: SerializableTextEdit,
        public readonly additionalTextEdits?: SerializableTextEdit[]) {
    }
}

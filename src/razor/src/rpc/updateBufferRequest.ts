/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServerTextChange } from './serverTextChange';

export class UpdateBufferRequest {
    constructor(
        public readonly hostDocumentVersion: number,
        public readonly hostDocumentFilePath: string,
        public readonly changes: ServerTextChange[],
        public readonly previousWasEmpty: boolean,
        public readonly checksum: Uint8Array,
        public readonly checksumAlgorithm: number,
        public readonly encodingCodePage: number | null
    ) {}
}

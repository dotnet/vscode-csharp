/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import removeBomBuffer from 'strip-bom-buf';
import removeBomString from 'strip-bom';

export function removeBOMFromBuffer(buffer: Buffer): Buffer {
    return removeBomBuffer(buffer);
}

export function removeBOMFromString(line: string): string {
    return removeBomString(line.trim());
}

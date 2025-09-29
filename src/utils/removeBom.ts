/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as NodeBuffer from 'node:buffer';

export function removeBOMFromBuffer(buffer: Buffer): Buffer {
    return buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf && NodeBuffer.isUtf8(buffer)
        ? buffer.subarray(3)
        : buffer;
}

export function removeBOMFromString(line: string): string {
    line = line.trim();
    return line.charCodeAt(0) === 0xfeff ? line.slice(1) : line;
}

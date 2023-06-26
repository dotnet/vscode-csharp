/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from "crypto";
import { EventStream } from "../eventStream";
import { IntegrityCheckSuccess, DownloadValidation } from "../omnisharp/loggingEvents";

export interface DownloadValidator {
    (buffer: Buffer, integrity: string | undefined, eventStream: EventStream): boolean;
}

export function isValidDownload(buffer: Buffer, integrity: string | undefined, eventStream: EventStream): boolean {
    if (integrity !== undefined && integrity.length > 0) {
        eventStream.post(new DownloadValidation());
        const value = getBufferIntegrityHash(buffer);
        if (value === integrity.toUpperCase()) {
            eventStream.post(new IntegrityCheckSuccess());
            return true;
        }
        else {
            return false;
        }
    }

    // no integrity has been specified
    return true;
}

export function getBufferIntegrityHash(buffer: Buffer): string {
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    const value = hash.digest('hex').toUpperCase();
    return value;
}

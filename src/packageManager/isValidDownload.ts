/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from "crypto";
import { EventStream } from "../EventStream";
import { IntegrityCheckSuccess, DownloadValidation } from "../omnisharp/loggingEvents";

export interface DownloadValidator {
    (buffer: Buffer, integrity: string, eventStream: EventStream): boolean;
}

export function isValidDownload(buffer: Buffer, integrity: string, eventStream: EventStream): boolean {
    let hash = crypto.createHash('sha256');
    if (integrity && integrity.length > 0) {
        eventStream.post(new DownloadValidation());
        hash.update(buffer);
        let value = hash.digest('hex');       
        if (value.toUpperCase() == integrity.toUpperCase()) {         
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
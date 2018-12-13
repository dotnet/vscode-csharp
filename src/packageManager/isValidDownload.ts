/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from "crypto";

export function isValidDownload(buffer: Buffer, integrity: string): boolean {
    let hash = crypto.createHash('sha256');
    if (integrity && integrity.length > 0) {
        hash.update(buffer);
        let value = hash.digest('hex');
        if (value.toUpperCase() == integrity.toUpperCase()) {
            return true;
        }
        else {
            return false;
        }
    }

    // no integrity has been specified
    return true;
}
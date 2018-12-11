/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as stream from "stream";
import * as crypto from "crypto";

const hash = crypto.createHash('sha256');

export async function isValidDownload(buffer: Buffer, integrity: string): Promise<boolean> {
    if (integrity && integrity.length > 0) {
        return new Promise<boolean>((resolve) => {
            let value: string;
            var bufferStream = new stream.PassThrough();
            bufferStream.end(buffer);
            bufferStream.on("readable", () => {
                const data = bufferStream.read();
                if (data) {
                    hash.update(data);
                }
            });
            bufferStream.on('end', () => {
                value = hash.digest('hex');
                if (value == integrity) {
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            });

            bufferStream.on("error", () => {
                //if the bufferstream errored
                resolve(false);
            });
        });
    }

    // no sha has been specified
    return true;
}
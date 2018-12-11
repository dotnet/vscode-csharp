/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as stream from "stream";
import * as crypto from "crypto";

const hash = crypto.createHash('sha256');

export async function isValidDownload(buffer: Buffer, sha: string): Promise<boolean> {
    if (sha && sha.length > 0) {

        return new Promise<boolean>((resolve, reject) => {
            let value: string;
            var bufferStream = new stream.PassThrough();
            bufferStream.end(buffer);
            bufferStream.on("readable", () => {
                const data = bufferStream.read();
                if (data) {
                    hash.update(data);
                }
                else {
                    value = hash.digest('hex');
                }
            });
            bufferStream.on('end', () => {
                value = hash.digest('hex');
                if (value == sha) {
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            });
        });
    }

    // no sha has been specified
    return true;
}
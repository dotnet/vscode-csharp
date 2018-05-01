/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';

export default async function ReadFileIntoBuffer(filepath: string): Promise<Buffer> {
    let buffers: any[] = [];
    return new Promise<Buffer>(resolve => {
        let readStream = fs.createReadStream(filepath);
        readStream.on('data', data => buffers.push(data));
        readStream.on('end', () => resolve(Buffer.concat(buffers)));
    });
}
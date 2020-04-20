/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as archiver from 'archiver';
import { TestFile } from './TestFile';

export default class TestZip {
    constructor(private readonly _buffer: Buffer, private readonly _files: TestFile[]) {
    }

    get buffer(): Buffer {
        return this._buffer;
    }

    get size(): number {
        return this._buffer.length;
    }

    get files(): TestFile[] {
        return this._files;
    }

    public static async createTestZipAsync(...filesToAdd: TestFile[]): Promise<TestZip> {
        let buffers: any[] = [];
        let finalBuffer = await new Promise<Buffer>((resolve, reject) => {
            let archive = archiver('zip');
            archive.on('warning', function (err: any) {
                if (err.code === 'ENOENT') {
                    console.log(err);
                } else {
                    // throw error
                    reject(err);
                }
            });
            archive.on('data', data => buffers.push(data));
            archive.on('error', reject);
            archive.on('end', () => resolve(Buffer.concat(buffers)));
            filesToAdd.forEach(elem => archive.append(elem.content, { name: elem.path }));
            archive.finalize();
        });

        return new TestZip(finalBuffer, filesToAdd);
    }
}


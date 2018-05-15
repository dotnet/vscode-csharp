/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as archiver from 'archiver';

export const Files = [
    {
        content: "File 1",
        path: "file1.txt",

    },
    {
        content: "File 2",
        path: "folder/file2.txt"
    }
];

export const Binaries = [
    {
        content: "Binary 1",
        path: "binary1.txt"
    },
];


export async function createTestZipAsync(filesToAdd: Array<{ content: string, path: string }>): Promise<Buffer> {
    let buffers: any[] = [];
    return new Promise<Buffer>((resolve, reject) => {
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
}
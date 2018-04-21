/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as archiver from 'archiver';
import * as fs from 'async-file';

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


export async function createTestZipAsync(dirPath: string, filesToAdd: Array<{ content: string, path: string }>): Promise<{}> {
    let output = fs.createWriteStream(dirPath);

    return new Promise((resolve, reject) => {
        output.on('close', function () {
            resolve(); // the installer needs to wait for the filestream to be closed here
        });

        let archive = archiver('zip');
        archive.on('warning', function (err: any) {
            if (err.code === 'ENOENT') {
                console.log(err);
            } else {
                // throw error
                reject(err);
            }
        });

        archive.on('error', reject);
        archive.pipe(output);
        filesToAdd.forEach(elem => archive.append(elem.content, { name: elem.path }));
        archive.finalize();
    });
}
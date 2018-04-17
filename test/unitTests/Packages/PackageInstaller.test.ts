/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
//import * as tmp from 'tmp';
import { createTmpDir, TmpAsset } from '../../../src/CreateTmpAsset';
//import { InstallPackage } from '../../../src/packageManager/PackageInstaller';
//import { EventStream } from '../../../src/EventStream';
let archiver = require('archiver');

suite('PackageInstaller', () => {
    let tmpSourceDir: TmpAsset;
    //let tmpInstallDir: TmpAsset;

    const filesToAdd = [
        {
            content: "File 1",
            path: "file1.txt"
        },
        {
            content: "File 2",
            path: "folder/file2.txt"
        }
    ];

    const binariesToAdd = [
        {
            content: "Binary 1",
            path: "binary1.txt"
        },
    ];

    //let eventStream = new EventStream();

    setup(() => {
        //when cleaning, clean the directory even if it is not empty
        tmpSourceDir = createTmpDir(true);
        //tmpInstallDir = createTmpDir(true);
    });

    test('The package is installed', () => {
        let testDirPath = tmpSourceDir.name + "test.zip";
        createTestZip(testDirPath, [...filesToAdd, ...binariesToAdd]);
        //let fd = fs.openSync(testDirPath, 'r');
        //console.log(fs.readlinkSync('/proc/self/fd/' + fd));
        //console.log(testDirPath);
        //await InstallPackage(tmpSourceDir.fd, "somePackage", tmpInstallDir.name, [], eventStream);
    });

    teardown(async () => {
        tmpSourceDir.dispose();
    });
});

function createTestZip(dirPath: string, filesToAdd: Array<{ content: string, path: string }>) {

    let output = fs.createWriteStream(dirPath);
    let archive = archiver('zip');

    archive.on('warning', function (err: any) {
        if (err.code === 'ENOENT') {
            console.log(err);
        } else {
            // throw error
            throw err;
        }
    });

    // good practice to catch this error explicitly
    archive.on('error', function (err: any) {
        throw err;
    });

    archive.pipe(output);

    filesToAdd.forEach(elem => archive.append(elem.content, { name: elem.path }));
    // append a file from string
    archive.finalize();
}

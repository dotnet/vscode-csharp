/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as path from 'path';
//import * as tmp from 'tmp';
import { createTmpDir, TmpAsset } from '../../../src/CreateTmpAsset';
import * as util from '../../../src/common';
import { InstallPackage } from '../../../src/packageManager/ZipInstaller';
import { EventStream } from '../../../src/EventStream';
import { PlatformInformation } from '../../../src/platform';
import * as archiver from 'archiver';
const chai = require("chai");
let expect = chai.expect;

suite('PackageInstaller', () => {
    let tmpSourceDir: TmpAsset;
    let tmpInstallDir: TmpAsset;
    let testDirPath: string;
    let fd: number;

    const files = [
        {
            content: "File 1",
            path: "file1.txt",

        },
        {
            content: "File 2",
            path: "folder/file2.txt"
        }
    ];

    const binaries = [
        {
            content: "Binary 1",
            path: "binary1.txt"
        },
    ];

    const eventStream = new EventStream();
    let allFiles: Array<{ content: string, path: string }>;

    setup(async () => {
        tmpSourceDir = await createTmpDir(true);
        tmpInstallDir = await createTmpDir(true);
        allFiles = [...files, ...binaries];
        testDirPath = tmpSourceDir.name + "/test.zip";
        await createTestZipAsync(testDirPath, allFiles);
        fd = await fs.open(path.resolve(testDirPath), 'r');
    });

    test('The folder is unzipped and all the files are present at the expected paths', async () => {
        await InstallPackage(fd, "somePackage", tmpInstallDir.name, [], eventStream);
        for (let elem of allFiles) {
            let filePath = path.join(tmpInstallDir.name, elem.path);
            expect(await util.fileExists(filePath)).to.be.true;
        }
    });

    test('The folder is unzipped and the binaries have the expected permissions(except on Windows)', async () => {
        if (!(await PlatformInformation.GetCurrent()).isWindows()) {
            await InstallPackage(fd, "somePackage", tmpInstallDir.name, binaries.map(binary => binary.path), eventStream);
            for (let elem of binaries) {
                let filePath = path.join(tmpInstallDir.name, elem.path);
                expect(await util.fileExists(filePath)).to.be.true;
                let mode = (await fs.stat(filePath)).mode;
                expect(mode).to.be.equal(0o755);
            }
        }
    });

    teardown(async () => {
        await fs.close(fd);
        tmpSourceDir.dispose();
        tmpInstallDir.dispose();
    });

    async function createTestZipAsync(dirPath: string, filesToAdd: Array<{ content: string, path: string }>): Promise<{}> {
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
});

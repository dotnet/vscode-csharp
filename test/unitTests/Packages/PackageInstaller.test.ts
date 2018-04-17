/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';

import * as path from 'path';
//import * as tmp from 'tmp';
import { createTmpDir, TmpAsset } from '../../../src/CreateTmpAsset';
import * as util from '../../../src/common';
import { InstallPackage } from '../../../src/packageManager/PackageInstaller';
import { EventStream } from '../../../src/EventStream';
import { PlatformInformation } from '../../../src/platform';
let archiver = require('archiver');
const chai = require("chai");
let expect = chai.expect;

suite('PackageInstaller', () => {
    let tmpSourceDir: TmpAsset;
    let tmpInstallDir: TmpAsset;
    let signalClose: () => void;
    let fileStreamClosePromise: Promise<void>;
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
        tmpSourceDir = createTmpDir(true);
        tmpInstallDir = createTmpDir(true);
        fileStreamClosePromise = new Promise<void>(resolve => {
            signalClose = () => {
                resolve();
            };
        });

        allFiles = [...files, ...binaries];

        testDirPath = tmpSourceDir.name + "/test.zip";
        createTestZip(testDirPath, allFiles);
        await fileStreamClosePromise;
        fd = fs.openSync(path.resolve(testDirPath), 'r');
    });

    test('The folder is unzipped and all the files are present at the expected paths', async () => {
        await InstallPackage(fd, "somePackage", tmpInstallDir.name, [], eventStream);
        for (let elem of allFiles) {
            let filePath = path.join(tmpInstallDir.name, elem.path);
            expect(await util.fileExists(filePath)).to.be.true;
        }
        // check whether the files were installed correctly
    });

    test('The folder is unzipped and the binaries have the expected permissions on Linux', async () => {
        if ((await PlatformInformation.GetCurrent()).isLinux()) {
            await InstallPackage(fd, "somePackage", tmpInstallDir.name, binaries.map(binary => binary.path), eventStream);
            for (let elem of binaries) {
                let filePath = path.join(tmpInstallDir.name, elem.path);
                expect(await util.fileExists(filePath)).to.be.true;
                let mode = fs.statSync(filePath).mode;
                expect(mode).to.be.equal(0o755);
            }
        }
    });



    teardown(async () => {
        fs.closeSync(fd);
        //Close the opened file
        tmpSourceDir.dispose();
        tmpInstallDir.dispose();
        fileStreamClosePromise = undefined;
    });

    function createTestZip(dirPath: string, filesToAdd: Array<{ content: string, path: string }>) {
        let output = fs.createWriteStream(dirPath);
        output.on('close', function () {
            signalClose(); // the installer needs to wait for the filestream to be closed here
        });
        let archive = archiver('zip');
        archive.on('warning', function (err: any) {
            if (err.code === 'ENOENT') {
                console.log(err);
            } else {
                // throw error
                throw err;
            }
        });

        archive.on('error', function (err: any) {
            throw err;
        });

        archive.pipe(output);
        filesToAdd.forEach(elem => archive.append(elem.content, { name: elem.path }));
        archive.finalize();
    }
});

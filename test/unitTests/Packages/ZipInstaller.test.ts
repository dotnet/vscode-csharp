/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as path from 'path';
import * as chai from 'chai';
import * as util from '../../../src/common';
import * as archiver from 'archiver';
import { createTmpDir, TmpAsset, createTmpFile } from '../../../src/CreateTmpAsset';
import { InstallPackage } from '../../../src/packageManager/ZipInstaller';
import { EventStream } from '../../../src/EventStream';
import { PlatformInformation } from '../../../src/platform';
import { BaseEvent, InstallationProgress } from '../../../src/omnisharp/loggingEvents';

chai.use(require("chai-as-promised"));
let expect = chai.expect;

suite('ZipInstaller', () => {
    let tmpSourceDir: TmpAsset;
    let tmpInstallDir: TmpAsset;
    let testDirPath: string;
    let zipFileDescriptor: number;
    let txtFile: TmpAsset;
    let installationPath: string;

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

    const fileDescription = "somefile";
    const eventStream = new EventStream();
    let eventBus: BaseEvent[];
    eventStream.subscribe((event) => eventBus.push(event));
    let allFiles: Array<{ content: string, path: string }>;

    setup(async () => {
        eventBus = [];
        tmpSourceDir = await createTmpDir(true);
        tmpInstallDir = await createTmpDir(true);
        installationPath = tmpInstallDir.name;
        txtFile = await createTmpFile();
        allFiles = [...files, ...binaries];
        testDirPath = tmpSourceDir.name + "/test.zip";
        await createTestZipAsync(testDirPath, allFiles);
        zipFileDescriptor = await fs.open(path.resolve(testDirPath), 'r');
        util.setExtensionPath(tmpInstallDir.name);
    });

    test('The folder is unzipped and all the files are present at the expected paths', async () => {
        await InstallPackage(zipFileDescriptor, fileDescription, installationPath, [], eventStream);
        for (let elem of allFiles) {
            let filePath = path.join(installationPath, elem.path);
            expect(await util.fileExists(filePath)).to.be.true;
        }
    });

    test('The folder is unzipped and all the expected events are created', async () => {
        await InstallPackage(zipFileDescriptor, fileDescription, installationPath, [], eventStream);
        let eventSequence: BaseEvent[] = [
            new InstallationProgress('installPackages', fileDescription)
        ];
        expect(eventBus).to.be.deep.equal(eventSequence);
    });

    test('The folder is unzipped and the binaries have the expected permissions(except on Windows)', async () => {
        if (!((await PlatformInformation.GetCurrent()).isWindows())) {
            let resolvedBinaryPaths = binaries.map(binary => path.join(installationPath, binary.path));
            await InstallPackage(zipFileDescriptor, fileDescription, installationPath, resolvedBinaryPaths, eventStream);
            for (let binaryPath of resolvedBinaryPaths) {
                expect(await util.fileExists(binaryPath)).to.be.true;
                let mode = (await fs.stat(binaryPath)).mode;
                expect(mode & 0o7777).to.be.equal(0o755, `Expected mode for path ${binaryPath}`);
            }
        }
    });

    test('Error is thrown when the file is not a zip', async () => {
        expect(InstallPackage(txtFile.fd, "Text File", installationPath, [], eventStream)).to.be.rejected;
    });

    test('Error is thrown on invalid input file', async () => {
        //fd=0 means there is no file
        expect(InstallPackage(0, fileDescription, "someRandomPath", [], eventStream)).to.be.rejected;
    });

    teardown(async () => {
        await fs.close(zipFileDescriptor);
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

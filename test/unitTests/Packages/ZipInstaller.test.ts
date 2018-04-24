/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as path from 'path';
import * as chai from 'chai';
import * as util from '../../../src/common';
import { CreateTmpDir, TmpAsset, CreateTmpFile } from '../../../src/CreateTmpAsset';
import { InstallZip } from '../../../src/packageManager/ZipInstaller';
import { EventStream } from '../../../src/EventStream';
import { PlatformInformation } from '../../../src/platform';
import { BaseEvent, InstallationStart } from '../../../src/omnisharp/loggingEvents';
import { Files, Binaries, createTestZipAsync } from '../testAssets/CreateTestZip';

chai.use(require("chai-as-promised"));
let expect = chai.expect;

suite('ZipInstaller', () => {
    let tmpSourceDir: TmpAsset;
    let tmpInstallDir: TmpAsset;
    let testDirPath: string;
    let zipFileDescriptor: number;
    let txtFile: TmpAsset;
    let installationPath: string;

    const fileDescription = "somefile";
    const eventStream = new EventStream();
    let eventBus: BaseEvent[];
    eventStream.subscribe((event) => eventBus.push(event));
    let allFiles: Array<{ content: string, path: string }>;

    setup(async () => {
        eventBus = [];
        tmpSourceDir = await CreateTmpDir(true);
        tmpInstallDir = await CreateTmpDir(true);
        installationPath = tmpInstallDir.name;
        txtFile = await CreateTmpFile();
        allFiles = [...Files, ...Binaries];
        testDirPath = tmpSourceDir.name + "/test.zip";
        await createTestZipAsync(testDirPath, allFiles);
        zipFileDescriptor = await fs.open(path.resolve(testDirPath), 'r');
        util.setExtensionPath(tmpInstallDir.name);
    });

    test('The folder is unzipped and all the files are present at the expected paths', async () => {
        await InstallZip(zipFileDescriptor, fileDescription, installationPath, [], eventStream);
        for (let elem of allFiles) {
            let filePath = path.join(installationPath, elem.path);
            expect(await util.fileExists(filePath)).to.be.true;
        }
    });

    test('The folder is unzipped and all the expected events are created', async () => {
        await InstallZip(zipFileDescriptor, fileDescription, installationPath, [], eventStream);
        let eventSequence: BaseEvent[] = [
            new InstallationStart(fileDescription)
        ];
        expect(eventBus).to.be.deep.equal(eventSequence);
    });

    test('The folder is unzipped and the binaries have the expected permissions(except on Windows)', async () => {
        if (!((await PlatformInformation.GetCurrent()).isWindows())) {
            let resolvedBinaryPaths = Binaries.map(binary => path.join(installationPath, binary.path));
            await InstallZip(zipFileDescriptor, fileDescription, installationPath, resolvedBinaryPaths, eventStream);
            for (let binaryPath of resolvedBinaryPaths) {
                expect(await util.fileExists(binaryPath)).to.be.true;
                let mode = (await fs.stat(binaryPath)).mode;
                expect(mode & 0o7777).to.be.equal(0o755, `Expected mode for path ${binaryPath}`);
            }
        }
    });

    test('Error is thrown when the file is not a zip', async () => {
        expect(InstallZip(txtFile.fd, "Text File", installationPath, [], eventStream)).to.be.rejected;
    });

    test('Error is thrown on invalid input file', async () => {
        //fd=0 means there is no file
        expect(InstallZip(0, fileDescription, "someRandomPath", [], eventStream)).to.be.rejected;
    });

    teardown(async () => {
        await fs.close(zipFileDescriptor);
        tmpSourceDir.dispose();
        tmpInstallDir.dispose();
    });
});

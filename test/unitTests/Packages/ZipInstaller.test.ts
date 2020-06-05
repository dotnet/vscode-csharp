/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as path from 'path';
import * as chai from 'chai';
import * as util from '../../../src/common';
import { CreateTmpDir, TmpAsset } from '../../../src/CreateTmpAsset';
import { InstallZip } from '../../../src/packageManager/ZipInstaller';
import { EventStream } from '../../../src/EventStream';
import { PlatformInformation } from '../../../src/platform';
import { BaseEvent, InstallationStart, ZipError } from '../../../src/omnisharp/loggingEvents';
import { createTestFile } from '../testAssets/TestFile';
import TestZip from '../testAssets/TestZip';
import TestEventBus from '../testAssets/TestEventBus';
import { AbsolutePath } from '../../../src/packageManager/AbsolutePath';

chai.use(require("chai-as-promised"));
let expect = chai.expect;

suite('ZipInstaller', () => {
    const binaries = [
        createTestFile("binary1", "binary1.txt"),
        createTestFile("binary2", "binary2.txt")
    ];

    const files = [
        createTestFile("file1", "file1.txt"),
        createTestFile("file2", "folder/file2.txt")
    ];

    let tmpInstallDir: TmpAsset;
    let installationPath: AbsolutePath;
    let testZip: TestZip;
    const fileDescription = "somefile";
    let eventStream: EventStream;
    let eventBus: TestEventBus;

    setup(async () => {
        eventStream = new EventStream();
        eventBus = new TestEventBus(eventStream);
        tmpInstallDir = await CreateTmpDir(true);
        installationPath = new AbsolutePath(tmpInstallDir.name);
        testZip = await TestZip.createTestZipAsync(...files, ...binaries);
        util.setExtensionPath(tmpInstallDir.name);
    });

    test('The folder is unzipped and all the files are present at the expected paths', async () => {
        await InstallZip(testZip.buffer, fileDescription, installationPath, [], eventStream);
        for (let elem of testZip.files) {
            let filePath = path.join(installationPath.value, elem.path);
            expect(await util.fileExists(filePath)).to.be.true;
        }
    });

    test('The folder is unzipped and all the expected events are created', async () => {
        await InstallZip(testZip.buffer, fileDescription, installationPath, [], eventStream);
        let eventSequence: BaseEvent[] = [
            new InstallationStart(fileDescription)
        ];
        expect(eventBus.getEvents()).to.be.deep.equal(eventSequence);
    });

    test('The folder is unzipped and the binaries have the expected permissions(except on Windows)', async () => {
        if (!((await PlatformInformation.GetCurrent()).isWindows())) {
            let absoluteBinaries = binaries.map(binary => AbsolutePath.getAbsolutePath(installationPath.value, binary.path));
            await InstallZip(testZip.buffer, fileDescription, installationPath, absoluteBinaries, eventStream);
            for (let binaryPath of absoluteBinaries) {
                expect(await util.fileExists(binaryPath.value)).to.be.true;
                let mode = (await fs.stat(binaryPath.value)).mode;
                expect(mode & 0o7777).to.be.equal(0o755, `Expected mode for path ${binaryPath}`);
            }
        }
    });

    test('Error is thrown when the buffer contains an invalid zip', async () => {
        expect(InstallZip(Buffer.from("My file", "utf8"), "Text File", installationPath, [], eventStream)).to.be.rejected;
    });

    test('Error event is created when the buffer contains an invalid zip', async () => {
        try {
            await InstallZip(Buffer.from("some content", "utf8"), "Text File", installationPath, [], eventStream);
        }
        catch{
            let eventSequence: BaseEvent[] = [
                new InstallationStart("Text File"),
                new ZipError("C# Extension was unable to download its dependencies. Please check your internet connection. If you use a proxy server, please visit https://aka.ms/VsCodeCsharpNetworking")
            ];
            expect(eventBus.getEvents()).to.be.deep.equal(eventSequence);
        }
    });

    teardown(async () => {
        if (tmpInstallDir) {
            tmpInstallDir.dispose();
        }
        eventBus.dispose();
    });
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'async-file';
import * as path from 'path';
import * as util from '../../../../src/common';
import { CreateTmpDir, TmpAsset } from '../../../../src/createTmpAsset';
import { InstallZip } from '../../../../src/packageManager/zipInstaller';
import { EventStream } from '../../../../src/eventStream';
import { PlatformInformation } from '../../../../src/shared/platform';
import { BaseEvent, InstallationStart, ZipError } from '../../../../src/omnisharp/loggingEvents';
import { createTestFile } from '../testAssets/testFile';
import TestZip from '../testAssets/testZip';
import TestEventBus from '../testAssets/testEventBus';
import { AbsolutePath } from '../../../../src/packageManager/absolutePath';

describe('ZipInstaller', () => {
    const binaries = [createTestFile('binary1', 'binary1.txt'), createTestFile('binary2', 'binary2.txt')];

    const files = [createTestFile('file1', 'file1.txt'), createTestFile('file2', 'folder/file2.txt')];

    let tmpInstallDir: TmpAsset;
    let installationPath: AbsolutePath;
    let testZip: TestZip;
    const fileDescription = 'somefile';
    let eventStream: EventStream;
    let eventBus: TestEventBus;

    beforeEach(async () => {
        eventStream = new EventStream();
        eventBus = new TestEventBus(eventStream);
        tmpInstallDir = await CreateTmpDir(true);
        installationPath = new AbsolutePath(tmpInstallDir.name);
        testZip = await TestZip.createTestZipAsync(...files, ...binaries);
        util.setExtensionPath(tmpInstallDir.name);
    });

    test('The folder is unzipped and all the files are present at the expected paths', async () => {
        await InstallZip(testZip.buffer, fileDescription, installationPath, [], eventStream);
        for (const elem of testZip.files) {
            const filePath = path.join(installationPath.value, elem.path);
            expect(await util.fileExists(filePath)).toBe(true);
        }
    });

    test('The folder is unzipped and all the expected events are created', async () => {
        await InstallZip(testZip.buffer, fileDescription, installationPath, [], eventStream);
        const eventSequence: BaseEvent[] = [new InstallationStart(fileDescription)];
        expect(eventBus.getEvents()).toStrictEqual(eventSequence);
    });

    test('The folder is unzipped and the binaries have the expected permissions(except on Windows)', async () => {
        if (!(await PlatformInformation.GetCurrent()).isWindows()) {
            const absoluteBinaries = binaries.map((binary) =>
                AbsolutePath.getAbsolutePath(installationPath.value, binary.path)
            );
            await InstallZip(testZip.buffer, fileDescription, installationPath, absoluteBinaries, eventStream);
            for (const binaryPath of absoluteBinaries) {
                expect(await util.fileExists(binaryPath.value)).toBe(true);
                const mode = (await fs.stat(binaryPath.value)).mode;
                expect(mode & 0o7777).toEqual(0o755);
            }
        }
    });

    test('Error is thrown when the buffer contains an invalid zip', async () => {
        expect(
            InstallZip(Buffer.from('My file', 'utf8'), 'Text File', installationPath, [], eventStream)
        ).rejects.toThrow();
    });

    test('Error event is created when the buffer contains an invalid zip', async () => {
        try {
            await InstallZip(Buffer.from('some content', 'utf8'), 'Text File', installationPath, [], eventStream);
        } catch {
            const eventSequence: BaseEvent[] = [
                new InstallationStart('Text File'),
                new ZipError(
                    'C# Extension was unable to download its dependencies. Please check your internet connection. If you use a proxy server, please visit https://aka.ms/VsCodeCsharpNetworking'
                ),
            ];
            expect(eventBus.getEvents()).toStrictEqual(eventSequence);
        }
    });

    afterEach(async () => {
        if (tmpInstallDir) {
            tmpInstallDir.dispose();
        }
        eventBus.dispose();
    });
});

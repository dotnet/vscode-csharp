/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import { readFile, stat } from 'fs/promises';
import * as path from 'path';
import { Writable } from 'stream';

// Necessary when spying on module members.
jest.mock('fs', () => ({ __esModule: true, ...(<any>jest.requireActual('fs')) }));
import * as util from '../../../../src/common';
import { CreateTmpDir, TmpAsset } from '../../../createTmpAsset';
import { InstallZip } from '../../../../src/packageManager/zipInstaller';
import { EventStream } from '../../../../src/eventStream';
import { PlatformInformation } from '../../../../src/shared/platform';
import { BaseEvent, InstallationStart, ZipError } from '../../../../src/shared/loggingEvents';
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

    /**
     * Validates that InstallZip does not resolve until every extracted file has been fully written and closed.
     * Resolving on the read-stream end instead races with createWriteStream's async open, which failed macOS unit tests with ENOENT while reading an extracted file and ENOTEMPTY while deleting the temp directory.
     */
    test('The folder is unzipped only after extracted files are fully written', async () => {
        const releases: Array<() => void> = [];
        const createWriteStream = jest.spyOn(fs, 'createWriteStream').mockImplementation((filePath, options) => {
            const chunks: Buffer[] = [];
            const stream = new Writable({
                write(chunk, _encoding, callback) {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                    callback();
                },
                final(callback) {
                    releases.push(() => {
                        const mode =
                            typeof options === 'object' && options !== null && 'mode' in options
                                ? options.mode
                                : undefined;
                        fs.writeFileSync(filePath, Buffer.concat(chunks), { mode });
                        callback();
                    });
                },
            });
            return stream as unknown as fs.WriteStream;
        });

        try {
            let settled = false;
            const install = InstallZip(testZip.buffer, fileDescription, installationPath, [], eventStream).then(() => {
                settled = true;
            });

            // Hold the first write open. A correct installer stays pending; resolving on read-stream
            // 'end' continues through the remaining entries and settles without this release.
            await waitUntil(() => releases.length > 0 || settled);
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(settled).toBe(false);
            expect(releases).toHaveLength(1);

            releases[0]();
            for (let i = 1; i < testZip.files.length; i++) {
                await waitUntil(() => releases.length > i || settled);
                expect(settled).toBe(false);
                releases[i]();
            }

            await install;
            for (const elem of testZip.files) {
                const filePath = path.join(installationPath.value, elem.path);
                expect(await readFile(filePath, 'utf8')).toBe(elem.content);
            }
        } finally {
            createWriteStream.mockRestore();
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
                const mode = (await stat(binaryPath.value)).mode;
                expect(mode & 0o7777).toEqual(0o755);
            }
        }
    });

    test('Error is thrown when the buffer contains an invalid zip', async () => {
        await expect(
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

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error('Timed out waiting for zip extraction to reach the write stream.');
        }
        await new Promise((resolve) => setImmediate(resolve));
    }
}

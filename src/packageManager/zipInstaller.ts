/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { mkdirp } from 'async-file';
import * as path from 'path';
import * as yauzl from 'yauzl';
import { EventStream } from '../eventStream';
import { InstallationStart, ZipError } from '../omnisharp/loggingEvents';
import { NestedError } from '../nestedError';
import { AbsolutePath } from './absolutePath';

export async function InstallZip(
    buffer: Buffer,
    description: string,
    destinationInstallPath: AbsolutePath,
    binaries: AbsolutePath[] | undefined,
    eventStream: EventStream
): Promise<void> {
    eventStream.post(new InstallationStart(description));

    return new Promise<void>((resolve, reject) => {
        yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipFile) => {
            if (err !== null) {
                const message =
                    'C# Extension was unable to download its dependencies. Please check your internet connection. If you use a proxy server, please visit https://aka.ms/VsCodeCsharpNetworking';
                eventStream.post(new ZipError(message));
                return reject(new NestedError(message));
            }

            zipFile.readEntry();

            zipFile.on('entry', async (entry: yauzl.Entry) => {
                const absoluteEntryPath = path.resolve(destinationInstallPath.value, entry.fileName);

                if (entry.fileName.endsWith('/')) {
                    // Directory - create it
                    try {
                        await mkdirp(absoluteEntryPath, 0o775);
                        zipFile.readEntry();
                    } catch (err) {
                        const error = err as NodeJS.ErrnoException; // Hack for TypeScript to type err correctly
                        return reject(
                            new NestedError(
                                'Error creating directory for zip directory entry:' + error.code ?? '',
                                error
                            )
                        );
                    }
                } else {
                    // File - extract it
                    zipFile.openReadStream(entry, async (err, readStream) => {
                        if (err) {
                            return reject(new NestedError('Error reading zip stream', err));
                        }

                        try {
                            await mkdirp(path.dirname(absoluteEntryPath), 0o775);

                            // Make sure executable files have correct permissions when extracted
                            const binaryPaths = binaries?.map((binary) => binary.value);
                            const fileMode = binaryPaths?.includes(absoluteEntryPath) ? 0o755 : 0o664;

                            readStream.pipe(fs.createWriteStream(absoluteEntryPath, { mode: fileMode }));
                            readStream.on('end', () => zipFile.readEntry());
                        } catch (err) {
                            return reject(
                                new NestedError(
                                    'Error creating directory for zip file entry',
                                    err as NodeJS.ErrnoException
                                )
                            );
                        }
                    });
                }
            });

            zipFile.on('end', () => {
                resolve();
            });

            zipFile.on('error', (err) => {
                reject(new NestedError('Zip File Error:' + err.code || '', err));
            });
        });
    });
}

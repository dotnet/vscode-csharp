/*---------------------------------------------------------------------------------------------
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as tar from 'tar';
import { Readable } from 'stream';
import { EventStream } from '../eventStream';
import { InstallationStart, ZipError } from '../omnisharp/loggingEvents';
import { NestedError } from '../nestedError';
import { AbsolutePath } from './absolutePath';

export async function InstallTarGz(
    buffer: Buffer,
    description: string,
    destinationInstallPath: AbsolutePath,
    eventStream: EventStream
): Promise<void> {
    eventStream.post(new InstallationStart(description));

    return new Promise<void>((resolve, reject) => {
        const reader = new Readable();
        reader.push(buffer);
        reader.push(null);
        reader
            .pipe(
                tar.extract({
                    cwd: destinationInstallPath.value,
                })
            )
            .on('error', (err) => {
                const message = 'Error extracting tar file. ' + err.message;
                eventStream.post(new ZipError(message));
                return reject(new NestedError(message));
            })
            .on('end', () => resolve());
    });
}

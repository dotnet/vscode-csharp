/*---------------------------------------------------------------------------------------------
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as tar from 'tar';
import { Readable } from 'stream';
import { EventStream } from "../EventStream";
import { InstallationStart, ZipError } from "../omnisharp/loggingEvents";
import { NestedError } from '../NestedError';
import { AbsolutePath } from './AbsolutePath';

export async function InstallTarGz(buffer: Buffer, description: string, destinationInstallPath: AbsolutePath, eventStream: EventStream): Promise<void> {
    eventStream.post(new InstallationStart(description));

    return new Promise<void>((resolve, reject) => {
        const reader = new Readable();
        reader.push(buffer);
        reader.push(null);
        reader.pipe(
            tar.extract({
                cwd: destinationInstallPath.value
            })
        )
        .on('error', err => {
            let message = "C# Extension was unable to install its dependencies. Please check your internet connection. If you use a proxy server, please visit https://aka.ms/VsCodeCsharpNetworking";
            eventStream.post(new ZipError(message));
            return reject(new NestedError(message));
        })
        .on('end', () => resolve());
    });
}


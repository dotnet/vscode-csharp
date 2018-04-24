/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as tmp from 'tmp';
import { rimraf } from 'async-file';
import { NestedError } from './NestedError';

export async function CreateTmpFile(): Promise<TmpAsset> {
    const tmpFile = await new Promise<tmp.SynchrounousResult>((resolve, reject) => {
        tmp.file({ prefix: 'package-' }, (err, path, fd, cleanupCallback) => {
            if (err) {
                return reject(new NestedError('Error from tmp.file', err));
            }
            if (fd == 0) {
                return reject(new NestedError("Temporary package file unavailable"));
            }

            resolve(<tmp.SynchrounousResult>{ name: path, fd: fd, removeCallback: cleanupCallback });
        });
    });

    return {
        fd: tmpFile.fd,
        name: tmpFile.name,
        dispose: tmpFile.removeCallback
    };
}

export async function CreateTmpDir(unsafeCleanup: boolean): Promise<TmpAsset> {
    const tmpDir = await new Promise<tmp.SynchrounousResult>((resolve, reject) => {
        tmp.dir({ unsafeCleanup }, (err, path, cleanupCallback) => {
            if (err) {
                return reject(new NestedError('Error from tmp.dir', err));
            }

            resolve(<tmp.SynchrounousResult>{ name: path, removeCallback: cleanupCallback });
        });
    });

    return {
        fd: tmpDir.fd,
        name: tmpDir.name,
        dispose: () => {
            if (unsafeCleanup) {
                rimraf(tmpDir.name);//to delete directories that have folders inside them
            }
            else {
                tmpDir.removeCallback();
            }
        }
    };
}

export interface TmpAsset {
    fd: number;
    name: string;
    dispose: () => void;
}
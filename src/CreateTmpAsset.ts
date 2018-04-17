/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as tmp from 'tmp';
import { NestedError } from './packageManager/packages';
import { rimraf } from 'async-file';

export async function createTmpFile(): Promise<TmpAsset> {
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
        dispose: () => {
            if (tmpFile) {
                tmpFile.removeCallback();
            }
        }
    };    
}

export function createTmpDir(unsafeCleanup: boolean): TmpAsset {
    let tmpDir = tmp.dirSync();
    return {
        fd: tmpDir.fd,
        name: tmpDir.name,
        dispose: async () => {
            if (tmpDir) {
                if (unsafeCleanup) {
                    await rimraf(tmpDir.name);
                }
                else {
                    tmpDir.removeCallback();
                }    
            }
        }   
    };
}    

export interface TmpAsset {
    fd: number;
    name: string;
    dispose: () => void;
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as tmp from 'tmp';
import { NestedError } from './packages';

export class TmpFileManager {
    private tmpFile: tmp.SynchrounousResult;
    constructor() { }

    private async createTmpFile() {
        this.tmpFile = await new Promise<tmp.SynchrounousResult>((resolve, reject) => {
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
    }

    public async GetTmpFile() {
        await this.createTmpFile();
        return this.tmpFile;
    }

    public async CleanUpTmpFile() {
        if (this.tmpFile) {
            this.tmpFile.removeCallback();
        }
    }
}
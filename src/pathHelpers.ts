/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';

export enum PathKind {
    File,
    Directory
}

export function getPathKind(path: string): Promise<PathKind> {
    return new Promise<PathKind>((resolve, reject) =>
    {
        fs.lstat(path, (err, stats) => {
            if (err) {
                reject(err);
            }
            else if (stats.isFile()) {
                resolve(PathKind.File);
            }
            else if (stats.isDirectory()) {
                resolve(PathKind.Directory);
            }
            else {
                reject(Error(`Path is not file or directory: ${path}`));
            }
        });
    });
}

export function exists(path: string) {
    return new Promise<boolean>((resolve, reject) => {
        fs.exists(path, exists => {
            if (exists) {
                resolve(true);
            }
            else {
                resolve(false);
            }
        });
    });
}

export function mkdir(directoryPath: string) {
    return new Promise<boolean>((resolve, reject) => {
        fs.mkdir(directoryPath, err => {
            if (!err) {
                resolve(true);
            }
            else {
                reject(err);
            }
        });
    });
}
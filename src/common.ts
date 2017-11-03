/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let extensionPath: string;

export function setExtensionPath(path: string) {
    extensionPath = path;
}

export function getExtensionPath() {
    if (!extensionPath) {
        throw new Error('Failed to set extension path');
    }

    return extensionPath;
}

export function isBoolean(obj: any): obj is boolean {
    return obj === true || obj === false;
}

export function sum<T>(arr: T[], selector: (item: T) => number): number {
    return arr.reduce((prev, curr) => prev + selector(curr), 0);
}

/** Retrieve the length of an array. Returns 0 if the array is `undefined`. */
export function safeLength<T>(arr: T[] | undefined) {
    return arr ? arr.length : 0;
}

export function buildPromiseChain<T, TResult>(array: T[], builder: (item: T) => Promise<TResult>): Promise<TResult> {
    return array.reduce(
        (promise, n) => promise.then(() => builder(n)),
        Promise.resolve<TResult>(null));
}

export function execChildProcess(command: string, workingDirectory: string = getExtensionPath()): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        cp.exec(command, { cwd: workingDirectory, maxBuffer: 500 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            }
            else if (stderr && stderr.length > 0) {
                reject(new Error(stderr));
            }
            else {
                resolve(stdout);
            }
        });
    });
}

export function getUnixChildProcessIds(pid: number): Promise<number[]> {
    return new Promise<number[]>((resolve, reject) => {
        let ps = cp.exec('ps -A -o ppid,pid', (error, stdout, stderr) =>
        {
            if (error) {
                return reject(error);
            }

            if (stderr) {
                return reject(stderr);
            }

            if (!stdout) {
                return resolve([]);
            }

            let lines = stdout.split(os.EOL);
            let pairs = lines.map(line => line.trim().split(/\s+/));

            let children = [];

            for (let pair of pairs) {
                let ppid = parseInt(pair[0]);
                if (ppid === pid) {
                    children.push(parseInt(pair[1]));
                }
            }

            resolve(children);
        });

        ps.on('error', reject);
    });
}

export function fileExists(filePath: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
            if (stats && stats.isFile()) {
                resolve(true);
            }
            else {
                resolve(false);
            }
        });
    });
}

export function deleteIfExists(filePath: string): Promise<void> {
    return fileExists(filePath)
    .then((exists: boolean) => {
        return new Promise<void>((resolve, reject) => {
            if (!exists) {
                return resolve();
            }

            fs.unlink(filePath, err => {
                if (err) {
                    return reject(err);
                }

                resolve();
            });
        });
    });
}

export enum InstallFileType {
    Begin,
    Lock
}

function getInstallFilePath(type: InstallFileType): string {
    let installFile = 'install.' + InstallFileType[type];
    return path.resolve(getExtensionPath(), installFile);
}

export function installFileExists(type: InstallFileType): Promise<boolean> {
    return fileExists(getInstallFilePath(type));
}

export function touchInstallFile(type: InstallFileType): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.writeFile(getInstallFilePath(type), '', err => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

export function deleteInstallFile(type: InstallFileType): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.unlink(getInstallFilePath(type), err => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

export function convertNativePathToPosix(pathString: string): string {
    let parts = pathString.split(path.sep);
    return parts.join(path.posix.sep);
}

/**
 * This function checks to see if a subfolder is part of folder.
 * 
 * Assumes subfolder and folder are absolute paths and have consistent casing.
 * 
 * @param subfolder subfolder to check if it is part of the folder parameter
 * @param folder folder to check aganist
 */
export function isSubfolderOf(subfolder: string, folder: string): boolean {
    const subfolderArray: string[] = subfolder.split(path.sep);
    const folderArray: string[] = folder.split(path.sep);

    // Check to see that every sub directory in subfolder exists in folder.
    return subfolderArray.length <= folderArray.length && subfolderArray.every((subpath, index) => folderArray[index] === subpath);
}
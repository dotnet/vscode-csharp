/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AbsolutePath } from './packageManager/absolutePath';

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

export function getUnixTempDirectory() {
    const envTmp = process.env.TMPDIR;
    if (!envTmp) {
        return '/tmp/';
    }

    return envTmp;
}

export function sum<T>(arr: T[], selector: (item: T) => number): number {
    return arr.reduce((prev, curr) => prev + selector(curr), 0);
}

export async function mapAsync<T1, T2>(
    array: T1[],
    selector: (value: T1, index: number, array: T1[]) => Promise<T2>
): Promise<T2[]> {
    return Promise.all(array.map(selector));
}

export async function filterAsync<T>(
    array: T[],
    predicate: (value: T, index: number, array: T[]) => Promise<boolean>
): Promise<T[]> {
    const filterMap = await mapAsync(array, predicate);
    return array.filter((_, index) => filterMap[index]);
}

/** Retrieve the length of an array. Returns 0 if the array is `undefined`. */
export function safeLength<T>(arr: T[] | undefined) {
    return arr ? arr.length : 0;
}

export async function execChildProcess(
    command: string,
    workingDirectory: string,
    env: NodeJS.ProcessEnv
): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        cp.exec(command, { cwd: workingDirectory, maxBuffer: 500 * 1024, env: env }, (error, stdout, stderr) => {
            if (error) {
                reject(
                    new Error(`${error}
${stdout}
${stderr}`)
                );
            } else if (stderr && !stderr.includes('screen size is bogus')) {
                reject(new Error(stderr));
            } else {
                resolve(stdout);
            }
        });
    });
}

export async function getUnixChildProcessIds(pid: number): Promise<number[]> {
    return new Promise<number[]>((resolve, reject) => {
        cp.exec('ps -A -o ppid,pid', (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }

            if (stderr && !stderr.includes('screen size is bogus')) {
                return reject(new Error(stderr));
            }

            if (!stdout) {
                return resolve([]);
            }

            const lines = stdout.split(os.EOL);
            const pairs = lines.map((line) => line.trim().split(/\s+/));

            const children = [];

            for (const pair of pairs) {
                const ppid = parseInt(pair[0]);
                if (ppid === pid) {
                    children.push(parseInt(pair[1]));
                }
            }

            resolve(children);
        });
    });
}

export async function fileExists(filePath: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        fs.stat(filePath, (err, stats) => {
            if (stats && stats.isFile()) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

export async function deleteIfExists(filePath: string): Promise<void> {
    return fileExists(filePath).then(async (exists: boolean) => {
        return new Promise<void>((resolve, reject) => {
            if (!exists) {
                return resolve();
            }

            fs.unlink(filePath, (err) => {
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
    Lock,
}

export function getInstallFilePath(folderPath: AbsolutePath, type: InstallFileType): string {
    const installFile = 'install.' + InstallFileType[type];
    return path.resolve(folderPath.value, installFile);
}

export async function installFileExists(folderPath: AbsolutePath, type: InstallFileType): Promise<boolean> {
    return fileExists(getInstallFilePath(folderPath, type));
}

export async function touchInstallFile(folderPath: AbsolutePath, type: InstallFileType): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.writeFile(getInstallFilePath(folderPath, type), '', (err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

export async function deleteInstallFile(folderPath: AbsolutePath, type: InstallFileType): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.unlink(getInstallFilePath(folderPath, type), (err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

export function convertNativePathToPosix(pathString: string): string {
    const parts = pathString.split(path.sep);
    return parts.join(path.posix.sep);
}

/**
 * This function checks to see if a subfolder is part of a parent folder.
 *
 * Assumes subfolder and parent folder are absolute paths and have consistent casing.
 *
 * @param subfolder subfolder to check if it is part of the parent folder parameter
 * @param parentFolder folder to check aganist
 */
export function isSubfolderOf(subfolder: string, parentFolder: string): boolean {
    const subfolderArray: string[] = subfolder.split(path.sep);
    const parentFolderArray: string[] = parentFolder.split(path.sep);

    // Check to see that every sub directory in subfolder exists in folder.
    return (
        parentFolderArray.length <= subfolder.length &&
        parentFolderArray.every((subpath, index) => subfolderArray[index] === subpath)
    );
}

/**
 * Find PowerShell executable from PATH (for Windows only).
 */
export function findPowerShell(): string | undefined {
    const dirs: string[] = (process.env.PATH || '')
        .replace(/"+/g, '')
        .split(';')
        .filter((x) => x);
    const names: string[] = ['pwsh.exe', 'powershell.exe'];
    for (const name of names) {
        const candidates: string[] = dirs.reduce<string[]>((paths, dir) => [...paths, path.join(dir, name)], []);
        for (const candidate of candidates) {
            try {
                if (fs.statSync(candidate).isFile()) {
                    return name;
                }
            } catch (_) {
                /* empty */
            }
        }
    }
}

export function isNotNull<T>(value: T): asserts value is NonNullable<T> {
    if (value === null || value === undefined) {
        throw new Error('value is null or undefined.');
    }
}

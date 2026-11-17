/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as fs from 'fs';
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

export async function execChildProcess(
    command: string,
    workingDirectory: string | undefined,
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

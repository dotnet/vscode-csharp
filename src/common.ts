/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as fs from 'fs';
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

export function getBinPath() {
    return path.resolve(getExtensionPath(), "bin");
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
 * Splits a string of command line arguments into a string array. This function
 * handles double-quoted arguments, but it is tailored toward the needs of the
 * text returned by VSTest, and is not generally useful as a command line parser.
 * @param commandLineString Text of command line arguments
 */
export function splitCommandLineArgs(commandLineString: string): string[] {
     let result = [];
     let start = -1;
     let index = 0;
     let inQuotes = false;

     while (index < commandLineString.length) {
         let ch = commandLineString[index];

         // Are we starting a new word?
         if (start === -1 && ch !== ' ' && ch !== '"') {
             start = index;
         }

         // is next character quote?
         if (ch === '"') {
             // Are we already in a quoted argument? If so, push the argument to the result list.
             // If not, start a new quoted argument.
             if (inQuotes) {
                 let arg = start >= 0
                    ? commandLineString.substring(start, index)
                    : "";
                 result.push(arg);
                 start = -1;
                 inQuotes = false;
             }
             else {
                 inQuotes = true;
             }
         }

         if (!inQuotes && start >= 0 && ch === ' ') {
             let arg = commandLineString.substring(start, index);
             result.push(arg);
             start = -1;
         }

         index++;
     }

     if (start >= 0) {
         let arg = commandLineString.substring(start, commandLineString.length);
         result.push(arg);
     }

     return result;
}

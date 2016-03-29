/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

let _extensionDir: string = '';
let _coreClrDebugDir: string = '';
let _debugAdapterDir: string = '';
let _installLogPath: string = '';
let _installBeginFilePath: string = '';
let _installCompleteFilePath: string = '';

export function setExtensionDir(extensionDir: string) {
    // ensure that this path actually exists and looks like the root of the extension
    if (!existsSync(path.join(extensionDir, 'package.json'))) {
        throw new Error(`Cannot set extension path to ${extensionDir}`);
    }
    _extensionDir = extensionDir;
    _coreClrDebugDir = path.join(_extensionDir, 'coreclr-debug');
    _debugAdapterDir = path.join(_coreClrDebugDir, 'debugAdapters');
    _installLogPath = path.join(_coreClrDebugDir, 'install.log');
    _installBeginFilePath = path.join(_coreClrDebugDir, 'install.begin');
    _installCompleteFilePath = path.join(_debugAdapterDir, 'install.complete');
}

export function extensionDir(): string {
    if (_extensionDir === '')
    {
        throw new Error('Failed to set extension directory');
    }
    return _extensionDir;
}

export function coreClrDebugDir(): string {
    if (_coreClrDebugDir === '') {
        throw new Error('Failed to set coreclrdebug directory');
    }
    return _coreClrDebugDir;
}

export function debugAdapterDir(): string {
    if (_debugAdapterDir === '') {
        throw new Error('Failed to set debugadpter directory');
    }
    return _debugAdapterDir;
}

export function installLogPath(): string {
    if (_installLogPath === '') {
        throw new Error('Failed to set install log path');
    }
    return _installLogPath;
}

export function installBeginFilePath(): string {
    if (_installBeginFilePath === '') {
        throw new Error('Failed to set install begin file path');
    }
    return _installBeginFilePath;
}

export function installCompleteFilePath(): string {
    if (_installCompleteFilePath === '')
    {
        throw new Error('Failed to set install complete file path');
    }
    return _installCompleteFilePath;
}

export function installCompleteExists() : boolean {
    return existsSync(installCompleteFilePath());
}

export function existsSync(path: string) : boolean {
    try {
        fs.accessSync(path, fs.F_OK);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        } else {
            throw Error(err.code);
        }
    }
}

export function getPlatformExeExtension() : string {
    if (process.platform === 'win32') {
        return '.exe';
    }

    return '';
}

export function getPlatformLibExtension() : string {
    switch (process.platform) {
        case 'win32':
            return '.dll';
        case 'darwin':
            return '.dylib';
        case 'linux':
            return '.so';
        default:
            throw Error('Unsupported platform ' + process.platform);
    }
}

/** Used for diagnostics only */
export function logToFile(message: string): void {
    let logFolder = path.resolve(coreClrDebugDir(), "extension.log");
    fs.writeFileSync(logFolder, `${message}${os.EOL}`, { flag: 'a' });
}

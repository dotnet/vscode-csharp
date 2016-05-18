/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process'

let _extensionDir: string = '';
let _coreClrDebugDir: string = '';
let _debugAdapterDir: string = '';
let _installLogPath: string = '';
let _installBeginFilePath: string = '';
let _installCompleteFilePath: string = '';

export default class CoreClrDebugUtil
{
    private _extensionDir: string = '';
    private _coreClrDebugDir: string = '';
    private _debugAdapterDir: string = '';
    private _installLogPath: string = '';
    private _installBeginFilePath: string = '';
    private _installCompleteFilePath: string = '';
    
    constructor(extensionDir) {
        _extensionDir = extensionDir;
        _coreClrDebugDir = path.join(_extensionDir, 'coreclr-debug');
        _debugAdapterDir = path.join(_coreClrDebugDir, 'debugAdapters');
        _installLogPath = path.join(_coreClrDebugDir, 'install.log');
        _installBeginFilePath = path.join(_coreClrDebugDir, 'install.begin');
        _installCompleteFilePath = path.join(_debugAdapterDir, 'install.complete');
    }
        
    extensionDir(): string {
        if (_extensionDir === '')
        {
            throw new Error('Failed to set extension directory');
        }
        return _extensionDir;
    }

    coreClrDebugDir(): string {
        if (_coreClrDebugDir === '') {
            throw new Error('Failed to set coreclrdebug directory');
        }
        return _coreClrDebugDir;
    }

    debugAdapterDir(): string {
        if (_debugAdapterDir === '') {
            throw new Error('Failed to set debugadpter directory');
        }
        return _debugAdapterDir;
    }

    installLogPath(): string {
        if (_installLogPath === '') {
            throw new Error('Failed to set install log path');
        }
        return _installLogPath;
    }

    installBeginFilePath(): string {
        if (_installBeginFilePath === '') {
            throw new Error('Failed to set install begin file path');
        }
        return _installBeginFilePath;
    }

    installCompleteFilePath(): string {
        if (_installCompleteFilePath === '')
        {
            throw new Error('Failed to set install complete file path');
        }
        return _installCompleteFilePath;
    }
 
    static existsSync(path: string) : boolean {
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
    
    static getPlatformExeExtension() : string {
        if (process.platform === 'win32') {
            return '.exe';
        }

        return '';
    }

    static getPlatformLibExtension() : string {
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
    logToFile(message: string): void {
        let logFolder = path.resolve(this.coreClrDebugDir(), "extension.log");
        fs.writeFileSync(logFolder, `${message}${os.EOL}`, { flag: 'a' });
    }
}

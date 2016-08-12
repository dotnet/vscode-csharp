/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';

export class CoreClrDebugUtil
{
    private _extensionDir: string = '';
    private _coreClrDebugDir: string = '';
    private _debugAdapterDir: string = '';
    private _installLogPath: string = '';
    private _installBeginFilePath: string = '';
    private _installCompleteFilePath: string = '';

    private _installLog: fs.WriteStream = null;
    private _channel: vscode.OutputChannel = null;

    constructor(extensionDir: string, channel?: vscode.OutputChannel) {
        this._extensionDir = extensionDir;
        this._coreClrDebugDir = path.join(this._extensionDir, 'coreclr-debug');
        this._debugAdapterDir = path.join(this._coreClrDebugDir, 'debugAdapters');
        this._installLogPath = path.join(this._coreClrDebugDir, 'install.log');
        this._installBeginFilePath = path.join(this._coreClrDebugDir, 'install.begin');
        this._installCompleteFilePath = path.join(this._debugAdapterDir, 'install.complete');

        this._channel = channel;
    }

    extensionDir(): string {
        if (this._extensionDir === '')
        {
            throw new Error('Failed to set extension directory');
        }
        return this._extensionDir;
    }

    coreClrDebugDir(): string {
        if (this._coreClrDebugDir === '') {
            throw new Error('Failed to set coreclrdebug directory');
        }
        return this._coreClrDebugDir;
    }

    debugAdapterDir(): string {
        if (this._debugAdapterDir === '') {
            throw new Error('Failed to set debugadpter directory');
        }
        return this._debugAdapterDir;
    }

    installLogPath(): string {
        if (this._installLogPath === '') {
            throw new Error('Failed to set install log path');
        }
        return this._installLogPath;
    }

    installBeginFilePath(): string {
        if (this._installBeginFilePath === '') {
            throw new Error('Failed to set install begin file path');
        }
        return this._installBeginFilePath;
    }

    installCompleteFilePath(): string {
        if (this._installCompleteFilePath === '')
        {
            throw new Error('Failed to set install complete file path');
        }
        return this._installCompleteFilePath;
    }

    createInstallLog(): void {
        this._installLog = fs.createWriteStream(this.installLogPath());
    }

    closeInstallLog(): void {
        if (this._installLog !== null) {
            this._installLog.close();
        }
    }

    log(message: string): void {
        console.log(message);

        if (this._installLog != null) {
            this._installLog.write(message);
        }

        if (this._channel != null) {
            this._channel.appendLine(message);
        }
    }

    static writeEmptyFile(path: string) : Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.writeFile(path, '', (err) => {
                if (err) {
                    reject(err.code);
                } else {
                    resolve();
                }
            });
        });
    }

    public spawnChildProcess(process: string, args: string[], workingDirectory: string, onStdout?: (data: Buffer) => void, onStderr?: (data: Buffer) => void): Promise<void> {
        const promise = new Promise<void>((resolve, reject) => {
            const child = child_process.spawn(process, args, { cwd: workingDirectory });

            if (!onStdout) {
                onStdout = (data) => { this.log(`${data}`); };
            }
            child.stdout.on('data', onStdout);

            if (!onStderr) {
                onStderr = (data) => { this.log(`${data}`); };
            }
            child.stderr.on('data', onStderr);
            child.on('close', (code: number) => {
                if (code != 0) {
                    this.log(`${process} exited with error code ${code}`);;
                    reject(new Error(code.toString()));
                }
                else {
                    resolve();
                }
            });
        });

        return promise;
    }

    static existsSync(path: string) : boolean {
        try {
            fs.accessSync(path, fs.F_OK);
            return true;
        } catch (err) {
            if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
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

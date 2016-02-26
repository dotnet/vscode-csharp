/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let _coreClrDebugDir: string;
let _debugAdapterDir: string;
let _channel: vscode.OutputChannel;
let _installLog: NodeJS.WritableStream;
const _completionFileName: string = 'install.complete';

export function installCoreClrDebug(context: vscode.ExtensionContext) {
    _coreClrDebugDir = path.join(context.extensionPath, 'coreclr-debug');
    _debugAdapterDir = path.join(_coreClrDebugDir, 'debugAdapters');
    
    if (existsSync(path.join(_debugAdapterDir, _completionFileName))) {
        console.log('.NET Core Debugger tools already installed');
        return;
    }
    
    _channel = vscode.window.createOutputChannel('coreclr-debug');
    
    // Create our log file and override _channel.append to also outpu to the log
    _installLog = fs.createWriteStream(path.join(_coreClrDebugDir, 'install.log'));
    (function() {
        var proxied = _channel.append;
        _channel.append = function(val: string) {
            _installLog.write(val);
            proxied.apply(this, arguments);
        };
    })();

    _channel.appendLine("Downloading and configuring the .NET Core Debugger...");
    _channel.show(vscode.ViewColumn.Three);
    
    spawnChildProcess('dotnet', ['--verbose', 'restore'], _channel, _coreClrDebugDir)
    .then(function() {
        return spawnChildProcess('dotnet', ['--verbose', 'publish', '-o', _debugAdapterDir], _channel, _coreClrDebugDir);
    }).then(function() {
        var promises: Promise<void>[] = [];

        promises.push(renameDummyEntrypoint());
        promises.push(removeLibCoreClrTraceProvider());

        return Promise.all(promises);
    }).then(function() {
        return writeCompletionFile();
    }).then(function() {
        _channel.appendLine('Succesfully installed .NET Core Debugger.');
    })
    .catch(function(error) {
        _channel.appendLine('Error while installing .NET Core Debugger.');
        console.log(error);
    });
}

function writeCompletionFile() : Promise<void> {
    return new Promise<void>(function(resolve, reject) {
       fs.writeFile(path.join(_debugAdapterDir, _completionFileName), '', function(err) {
          if (err) {
              reject(err);
          } 
          else {
              resolve();
          }
       });
    });
}

function renameDummyEntrypoint() : Promise<void> {
    var src = path.join(_debugAdapterDir, 'dummy');
    var dest = path.join(_debugAdapterDir, 'OpenDebugAD7');

    src += getPlatformExeExtension();
    dest += getPlatformExeExtension();

    var promise = new Promise<void>(function(resolve, reject) {
       fs.rename(src, dest, function(err) {
           if (err) {
               reject(err);
           } else {
               resolve();
           }
       });
    });
    
    return promise;
}

function removeLibCoreClrTraceProvider() : Promise<void>
{
    var filePath = path.join(_debugAdapterDir, 'libcoreclrtraceptprovider' + getPlatformLibExtension());

    if (!existsSync(filePath)) {
        return Promise.resolve();
    } else {
        return new Promise<void>(function(resolve, reject) {
            fs.unlink(filePath, function(err) {
                if (err) {
                    reject(err);
                } else {
                    _channel.appendLine('Succesfully deleted ' + filePath);
                    resolve();
                }
            });
        });
    }
}

function existsSync(path: string) : boolean {
    try {
        fs.accessSync(path, fs.F_OK);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        } else {
            throw err;
        }
    }
}

function getPlatformExeExtension() : string {
    if (process.platform === 'win32') {
        return '.exe';
    }

    return '';
}

function getPlatformLibExtension() : string {
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

function spawnChildProcess(process: string, args: string[], channel: vscode.OutputChannel, workingDirectory: string) : Promise<void> {
    var promise = new Promise<void>( function (resolve, reject) {
        const child = child_process.spawn(process, args, {cwd: workingDirectory});

        child.stdout.on('data', (data) => {
            channel.append(`${data}`);
        });

        child.stderr.on('data', (data) => {
            channel.appendLine(`Error: ${data}`);
        });

        child.on('close', (code: number) => {
            if (code != 0) {
                channel.appendLine(`${process} exited with error code ${code}`);
                reject(new Error(code.toString()));    
            }
            else {
                resolve();
            }
        });
    });

    return promise;
}
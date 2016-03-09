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
    
    if (!isOnPath('dotnet')) {
        // TODO: In a future release, this should be an error. For this release, we will let it go
        console.log("The .NET CLI tools are not installed. .NET Core debugging will not be enabled.")
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
    
    spawnChildProcess('dotnet', ['--verbose', 'restore', '--configfile', 'NuGet.config'], _channel, _coreClrDebugDir)
    .then(function() {
        return spawnChildProcess('dotnet', ['--verbose', 'publish', '-o', _debugAdapterDir], _channel, _coreClrDebugDir);
    }).then(function() {
        return ensureAd7EngineExists(_channel, _debugAdapterDir);
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

// Determines if the specified command is in one of the directories in the PATH environment variable.
function isOnPath(command : string) : boolean {
    let pathValue = process.env['PATH'];
    if (!pathValue) {
        return false;
    }
    let fileName = command;
    let seperatorChar = ':';
    if (process.platform == 'win32') {
        // on Windows, add a '.exe', and the path is semi-colon seperatode
        fileName = fileName + ".exe";
        seperatorChar = ';';   
    }
    
    let pathSegments: string[] = pathValue.split(seperatorChar);
    for (var segment of pathSegments) {
        if (segment.length === 0 || !path.isAbsolute(segment)) {
            continue;
        }
        var segmentPath = path.join(segment, fileName);
        if (existsSync(segmentPath)) {
            return true;
        }
    }
    
    return false;
}

function ensureAd7EngineExists(channel: vscode.OutputChannel, outputDirectory: string) : Promise<void> {
    let filePath = path.join(outputDirectory, "coreclr.ad7Engine.json");
    return new Promise<void>((resolve, reject) => {
        fs.exists(filePath, (exists) => {
            if (exists) {
                return resolve();
            } else {
                channel.appendLine(`${filePath} does not exist.`);
                channel.appendLine('');
                // NOTE: The minimum build number is actually less than 1584, but this is the minimum
                // build that I have tested.
                channel.appendLine("Error: The .NET CLI did not correctly restore debugger files. Ensure that you have .NET CLI version 1.0.0 build #001584 or newer. You can check your .NET CLI version using 'dotnet --version'.");
                return reject("The .NET CLI did not correctly restore debugger files.");
            }
        });
    });
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
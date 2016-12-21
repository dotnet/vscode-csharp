/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';
import { DebugProtocol } from 'vscode-debugprotocol';
import * as child_process from 'child_process';
import { CoreClrDebugUtil } from './util';
import * as common from './../common';
import { Logger } from './../logger';

class ProxyErrorResponse implements DebugProtocol.ErrorResponse {
    public body: { error?: DebugProtocol.Message };
    public request_seq: number;
    public success: boolean;
    public command: string;
    public seq: number;
    public type: string;

    constructor(public message: string) {
        this.request_seq = 1;
        this.seq = 1;
        this.type = "response";
        this.success = false;
        this.command = "initialize";
    }
}

function serializeProtocolEvent(message: DebugProtocol.ProtocolMessage): string {
    const payload: string = JSON.stringify(message);
    const finalPayload: string = `Content-Length: ${payload.length}\r\n\r\n${payload}`;
    return finalPayload;
}

function sendErrorMessage(message: string) {
    process.stdout.write(serializeProtocolEvent(new ProxyErrorResponse(message)));
}

function sendStillDownloadingMessage() {
    sendErrorMessage('The .NET Core Debugger is still being downloaded. See the C# Output Window for more information.');
}

function sendDownloadingNotStartedMessage() {
    sendErrorMessage('Run \'Debug: Download .NET Core Debugger\' in the Command Palette or open a .NET project directory to download the .NET Core Debugger');
}

// The default extension manifest calls this proxy as the debugger program
// When installation of the debugger components finishes, the extension manifest is rewritten so that this proxy is no longer called
// If the debugger components have not finished downloading, the proxy displays an error message to the user
// If the debugger components have finished downloading, the manifest has been rewritten but has not been reloaded. 
// This proxy will still be called and launch OpenDebugAD7 as a child process.
// During subsequent code sessions, the rewritten manifest will be loaded and this proxy will no longer be called. 
function proxy() {
    let extensionPath = path.resolve(__dirname, '../../../');
    common.setExtensionPath(extensionPath);

    let logger = new Logger((text) => { console.log(text); });
    let util = new CoreClrDebugUtil(extensionPath, logger);
    
    if (!CoreClrDebugUtil.existsSync(util.installCompleteFilePath())) {
        // our install.complete file does not exist yet, meaning we have not rewritten our manifest yet. Try to figure out what if anything the package manager is doing
        // the order in which files are dealt with is this:
        // 1. install.Begin is created
        // 2. install.Lock is created
        // 3. install.Begin is deleted
        // 4. install.complete is created

        //first check if dotnet is on the path and new enough
        util.checkDotNetCli()
            .then((dotnetInfo) => {
                util.checkOpenSSLInstalledIfRequired().then((isInstalled) => {
                    if (isInstalled) {
                        // next check if we have begun installing packages
                        common.installFileExists(common.InstallFileType.Begin)
                            .then((beginExists: boolean) => {
                                if (beginExists) {
                                    // packages manager has begun
                                    sendStillDownloadingMessage();
                                } else {
                                    // begin doesn't exist. There is a chance we finished downloading and begin had been deleted. Check if lock exists
                                    common.installFileExists(common.InstallFileType.Lock)
                                        .then((lockExists) => {
                                            if (lockExists) {
                                                // packages have finished installing but we had not finished rewriting our manifest when F5 came in
                                                sendStillDownloadingMessage();
                                            }
                                            else {
                                                // no install files existed when we checked. we have likely not been activated
                                                sendDownloadingNotStartedMessage();
                                            }
                                        });
                                }
                            });
                    } else {
                        sendErrorMessage("The .NET Core debugger cannot be started. OpenSSL is not correctly configured. See the C# output channel for details.");
                    }
                });
            }, (err) => {
                // error from checkDotNetCli
                sendErrorMessage(err.ErrorMessage || util.defaultDotNetCliErrorMessage());
            });
    }
    else
    {
        // debugger has finished install and manifest has been rewritten, kick off our debugger process

        new Promise<void>((resolve, reject) => {
            let processPath = path.join(util.debugAdapterDir(), "OpenDebugAD7" + CoreClrDebugUtil.getPlatformExeExtension());
            let args = process.argv.slice(2);
            
            // do not explicitly set a current working dir
            // this seems to match what code does when OpenDebugAD7 is launched directly from the manifest
            const child = child_process.spawn(processPath, args);
            
            // If we don't exit cleanly from the child process, log the error.
            child.on('close', code => {
               if (code !== 0) {
                   reject(new Error(code.toString()));
               } else {
                   resolve();
               }
            });
            
            process.stdin.setEncoding('utf8');
            
            child.on('error', data => {
                logger.appendLine(`Child error: ${data}`); 
            });
            
            process.on('SIGTERM', () => {
                child.kill();
                process.exit(0); 
            });
            
            process.on('SIGHUP', () => {
                child.kill();
                process.exit(0); 
            });
            
            process.stdin.on('error', error => {
                logger.appendLine(`process.stdin error: ${error}`);
            });
            
            process.stdout.on('error', error => {
                logger.appendLine(`process.stdout error: ${error}`); 
            });
            
            child.stdout.on('data', data => {
                process.stdout.write(data); 
            });
            
            process.stdin.on('data', data => {
               child.stdin.write(data); 
            });
            
            process.stdin.resume();
        }).catch(err => {
           logger.appendLine(err);
        });
    }
}

proxy();
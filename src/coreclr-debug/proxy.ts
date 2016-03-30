/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';
import { DebugProtocol } from 'vscode-debugprotocol';
import * as child_process from 'child_process';
import CoreClrDebugUtil from './util';

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

// The default extension manifest calls this proxy as the debugger program
// When installation of the debugger components finishes, the extension manifest is rewritten so that this proxy is no longer called
// If the debugger components have not finished downloading, the proxy displays an error message to the user
// If the debugger components have finished downloading, the manifest has been rewritten but has not been reloaded. 
// This proxy will still be called and launch OpenDebugAD7 as a child process.
// During subsequent code sessions, the rewritten manifest will be loaded and this proxy will no longer be called. 
function proxy() {
    let util = new CoreClrDebugUtil(path.resolve(__dirname, '../../'));
    
    if (!CoreClrDebugUtil.existsSync(util.installCompleteFilePath())) {
        if (CoreClrDebugUtil.existsSync(util.installBeginFilePath())) {
            process.stdout.write(serializeProtocolEvent(new ProxyErrorResponse('The .NET Core Debugger has not finished installing. See Status Bar for details.')));
        } else {
            process.stdout.write(serializeProtocolEvent(new ProxyErrorResponse('Run \'Debugger: Install .NET Core Debugger\' command or open a .NET project directory to download the .NET Core Debugger')));
        }
    }
    else
    {
        new Promise<void>(function(resolve, reject) {
            let processPath = path.join(util.debugAdapterDir(), "OpenDebugAD7" + CoreClrDebugUtil.getPlatformExeExtension());
            let args = process.argv.slice(2);
            
            // do not explicitly set a current working dir
            // this seems to match what code does when OpenDebugAD7 is launched directly from the manifest
            const child = child_process.spawn(processPath, args);
            
            // If we don't exit cleanly from the child process, log the error.
            child.on('close', function(code: number) {
               if (code !== 0) {
                   reject(new Error(code.toString()));
               } else {
                   resolve();
               }
            });
            
            process.stdin.setEncoding('utf8');
            
            child.on('error', function(data) {
                util.logToFile(`Child error: ${data}`); 
            });
            
            process.on('SIGTERM', function() {
                child.kill();
                process.exit(0); 
            });
            
            process.on('SIGHUP', function() {
                child.kill();
                process.exit(0); 
            });
            
            process.stdin.on('error', function(error) {
                util.logToFile(`process.stdin error: ${error}`);
            });
            
            process.stdout.on('error', function(error) {
                util.logToFile(`process.stdout error: ${error}`); 
            });
            
            child.stdout.on('data', function(data) {
                process.stdout.write(data); 
            });
            
            process.stdin.on('data', function(data) {
               child.stdin.write(data); 
            });
            
            process.stdin.resume();
        }).catch(function(err) {
           util.logToFile(`Promise failed: ${err}`); 
        });
    }
}

proxy();
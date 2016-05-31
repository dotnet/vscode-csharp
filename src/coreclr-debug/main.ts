/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import TelemetryReporter from 'vscode-extension-telemetry';
import CoreClrDebugUtil from './util'

let _channel: vscode.OutputChannel;
let _installLog: NodeJS.WritableStream;
let _reporter: TelemetryReporter; // Telemetry reporter
let _util: CoreClrDebugUtil;

export function activate(context: vscode.ExtensionContext, reporter: TelemetryReporter) {    
    _util = new CoreClrDebugUtil(context.extensionPath);
    
    if (CoreClrDebugUtil.existsSync(_util.installCompleteFilePath())) {
        console.log('.NET Core Debugger tools already installed');
        return;
    }
    
    if (!isOnPath('dotnet')) {
        const getDotNetMessage = "Get .NET CLI tools"; 
        vscode.window.showErrorMessage("The .NET CLI tools cannot be located. .NET Core debugging will not be enabled. Make sure .NET CLI tools are installed and are on the path.",
            getDotNetMessage).then(function (value) {
                if (value === getDotNetMessage) {
                    let open = require('open');
                    open("http://dotnet.github.io/getting-started/");
                }
            });
            
        return;
    }
    
    _reporter = reporter;
    _channel = vscode.window.createOutputChannel('coreclr-debug');
    
    // Create our log file and override _channel.append to also output to the log
    _installLog = fs.createWriteStream(_util.installLogPath());
    (function() {
        let proxied = _channel.append;
        _channel.append = function(val: string) {
            _installLog.write(val);
            proxied.apply(this, arguments);
        };
    })();

    let statusBarMessage = vscode.window.setStatusBarMessage("Downloading and configuring the .NET Core Debugger...");
       
    let installStage = 'installBegin';
    let installError = '';
    
    writeInstallBeginFile().then(function() {
        installStage = 'writeProjectJson';
        return writeProjectJson(_channel);
    }).then(function() {
        installStage = 'dotnetRestore'
        return spawnChildProcess('dotnet', ['--verbose', 'restore', '--configfile', 'NuGet.config'], _channel, _util.coreClrDebugDir())  
    }).then(function() {
        installStage = "dotnetPublish";
        return spawnChildProcess('dotnet', ['--verbose', 'publish', '-o', _util.debugAdapterDir()], _channel, _util.coreClrDebugDir());
    }).then(function() {
        installStage = "ensureAd7";
        return ensureAd7EngineExists(_channel, _util.debugAdapterDir());
    }).then(function() {
        installStage = "additionalTasks";
        let promises: Promise<void>[] = [];

        promises.push(renameDummyEntrypoint());
        promises.push(removeLibCoreClrTraceProvider());

        return Promise.all(promises);
    }).then(function() {
        installStage = "rewriteManifest";
        rewriteManifest();
        installStage = "writeCompletionFile";
        return writeCompletionFile();
    }).then(function() {
        installStage = "completeSuccess";
        statusBarMessage.dispose();
        vscode.window.setStatusBarMessage('Successfully installed .NET Core Debugger.');
    })
    .catch(function(error) {
        const viewLogMessage = "View Log";
        vscode.window.showErrorMessage('Error while installing .NET Core Debugger.', viewLogMessage).then(function (value) {
            if (value === viewLogMessage) {
                _channel.show(vscode.ViewColumn.Three);
            }
        });
        statusBarMessage.dispose();
        
        installError = error.toString();
        console.log(error);
        
        
    }).then(function() {
        // log telemetry and delete install begin file
        logTelemetry('Acquisition', {installStage: installStage, installError: installError});
        
        try {
            deleteInstallBeginFile();
        } catch (err) {
            // if this throws there's really nothing we can do
        }
    });
}

function logTelemetry(eventName: string, properties?: {[prop: string]: string}) {
    if (_reporter)
    {
        _reporter.sendTelemetryEvent('coreclr-debug/' + eventName, properties);
    }
}

function rewriteManifest() : void {
    const manifestPath = path.join(_util.extensionDir(), 'package.json');
    let manifestString = fs.readFileSync(manifestPath, 'utf8');
    let manifestObject = JSON.parse(manifestString);
    manifestObject.contributes.debuggers[0].runtime = '';
    manifestObject.contributes.debuggers[0].program = './coreclr-debug/debugAdapters/OpenDebugAD7' + CoreClrDebugUtil.getPlatformExeExtension();
    manifestString = JSON.stringify(manifestObject, null, 2);
    fs.writeFileSync(manifestPath, manifestString);
}

function writeInstallBeginFile() : Promise<void> {
    return writeEmptyFile(_util.installBeginFilePath());
}

function deleteInstallBeginFile() {
    if (CoreClrDebugUtil.existsSync(_util.installBeginFilePath())) {
        fs.unlinkSync(_util.installBeginFilePath());
    }
}

function writeCompletionFile() : Promise<void> {
    return writeEmptyFile(_util.installCompleteFilePath());
}

function writeEmptyFile(path: string) : Promise<void> {
    return new Promise<void>(function(resolve, reject) {
       fs.writeFile(path, '', function(err) {
          if (err) {
              reject(err.code);
          } else {
              resolve();
          }
       });
    });
}

function renameDummyEntrypoint() : Promise<void> {
    let src = path.join(_util.debugAdapterDir(), 'dummy');
    let dest = path.join(_util.debugAdapterDir(), 'OpenDebugAD7');

    src += CoreClrDebugUtil.getPlatformExeExtension();
    dest += CoreClrDebugUtil.getPlatformExeExtension();

    const promise = new Promise<void>(function(resolve, reject) {
       fs.rename(src, dest, function(err) {
           if (err) {
               reject(err.code);
           } else {
               resolve();
           }
       });
    });
    
    return promise;
}

function removeLibCoreClrTraceProvider() : Promise<void>
{
    const filePath = path.join(_util.debugAdapterDir(), 'libcoreclrtraceptprovider' + CoreClrDebugUtil.getPlatformLibExtension());

    if (!CoreClrDebugUtil.existsSync(filePath)) {
        return Promise.resolve();
    } else {
        return new Promise<void>(function(resolve, reject) {
            fs.unlink(filePath, function(err) {
                if (err) {
                    reject(err.code);
                } else {
                    _channel.appendLine('Successfully deleted ' + filePath);
                    resolve();
                }
            });
        });
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
    for (let segment of pathSegments) {
        if (segment.length === 0 || !path.isAbsolute(segment)) {
            continue;
        }
        
        const segmentPath = path.join(segment, fileName);
        if (CoreClrDebugUtil.existsSync(segmentPath)) {
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

function writeProjectJson(channel: vscode.OutputChannel): Promise<void> {
    return new Promise<void>(function (resolve, reject) {
        const projectJsonPath = path.join(_util.coreClrDebugDir(), 'project.json');
        _channel.appendLine('Creating ' + projectJsonPath);

        const projectJson = createProjectJson(getPlatformRuntimeId(channel));
        
        fs.writeFile(projectJsonPath, JSON.stringify(projectJson, null, 2), {encoding: 'utf8'}, function(err) {
            if (err) {
               channel.appendLine('Error: Unable to write to project.json: ' + err.message);
               reject(err.code);
           }
           else {
               resolve();
           }
        });
    });
}

function getPlatformRuntimeId(channel: vscode.OutputChannel) : string {
    switch (process.platform) {
        case 'win32':
            return 'win7-x64';
        case 'darwin':
            return getDotnetRuntimeId(channel);
        case 'linux':
            return getDotnetRuntimeId(channel);
        default:
            channel.appendLine('Error: Unsupported platform ' + process.platform);
            throw Error('Unsupported platform ' + process.platform);
    }
}
    
function getDotnetRuntimeId(channel: vscode.OutputChannel): string {
    channel.appendLine("Starting 'dotnet --info'");

    const cliVersionErrorMessage = "Ensure that .NET Core CLI Tools version >= 1.0.0-beta-002173 is installed. Run 'dotnet --version' to see what version is installed.";

    let child = child_process.spawnSync('dotnet', ['--info'], { cwd: _util.coreClrDebugDir() });

    if (child.stderr.length > 0) {
        channel.append('Error: ' + child.stderr.toString());
    }
    const out = child.stdout.toString();
    if (out.length > 0) {
        channel.append(out);
    }

    if (child.status !== 0) {
        const message = `Error: 'dotnet --info' failed with error ${child.status}`;
        channel.appendLine(message);
        channel.appendLine(cliVersionErrorMessage);
        throw new Error(message);
    }

    if (out.length === 0) {
        const message = "Error: 'dotnet --info' provided no output";
        channel.appendLine(message);
        channel.appendLine(cliVersionErrorMessage);
        throw new Error(message);
    }

    let lines = out.split('\n');
    let ridLine = lines.filter(function (value) {
        return value.trim().startsWith('RID:');
    });

    if (ridLine.length < 1) {
        channel.appendLine("Error: Cannot find 'RID' property");
        channel.appendLine(cliVersionErrorMessage);
        throw new Error('Cannot obtain Runtime ID from dotnet cli');
    }

    let rid = ridLine[0].split(':')[1].trim();

    if (!rid) {
        channel.appendLine("Error: Unable to parse 'RID' property.");
        channel.appendLine(cliVersionErrorMessage);
        throw new Error('Unable to determine Runtime ID');
    }

    return rid;
}

function createProjectJson(targetRuntime: string): any
{
    let projectJson = {
        name: "dummy",
        buildOptions: {
            emitEntryPoint: true
        },
        dependencies: {
            "Microsoft.VisualStudio.clrdbg": "14.0.25320-preview-3008693",
            "Microsoft.VisualStudio.clrdbg.MIEngine": "14.0.30531-preview-1",
            "Microsoft.VisualStudio.OpenDebugAD7": "1.0.20527-preview-1",
            "NETStandard.Library": "1.5.0-rc2-24027",
            "Newtonsoft.Json": "7.0.1",
            "Microsoft.VisualStudio.Debugger.Interop.Portable": "1.0.1",
            "System.Collections.Specialized":  "4.0.1-rc2-24027",
            "System.Collections.Immutable": "1.2.0-rc2-24027", 
            "System.Diagnostics.Process" : "4.1.0-rc2-24027",
            "System.Diagnostics.StackTrace":  "4.0.1-rc2-24027",  
            "System.Dynamic.Runtime": "4.0.11-rc2-24027",
            "Microsoft.CSharp": "4.0.1-rc2-24027",
            "System.Threading.Tasks.Dataflow": "4.6.0-rc2-24027",
            "System.Threading.Thread": "4.0.0-rc2-24027", 
            "System.Xml.XDocument": "4.0.11-rc2-24027",
            "System.Xml.XmlDocument": "4.0.1-rc2-24027",  
            "System.Xml.XmlSerializer": "4.0.11-rc2-24027",
            "System.ComponentModel":  "4.0.1-rc2-24027",  
            "System.ComponentModel.Annotations":  "4.1.0-rc2-24027",  
            "System.ComponentModel.EventBasedAsync":  "4.0.11-rc2-24027",
            "System.Runtime.Serialization.Primitives": "4.1.1-rc2-24027",
            "System.Net.Http":  "4.0.1-rc2-24027"
        },
        frameworks: {
            "netstandardapp1.5": {
                imports: [ "dnxcore50", "portable-net45+win8" ]
            }
        },
        runtimes: {
        }
    }
    
    projectJson.runtimes[targetRuntime] = {};
    
    return projectJson;
}

function spawnChildProcess(process: string, args: string[], channel: vscode.OutputChannel, workingDirectory: string) : Promise<void> {
    const promise = new Promise<void>(function(resolve, reject) {
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

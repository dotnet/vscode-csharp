/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CoreClrDebugUtil } from './util';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import * as fs_extra from 'fs-extra-promise';

export class InstallError extends Error {
    public installStage: string;
    public installError: string;

    constructor(stage: string, error: string) {
        super("Error during installation.");
        this.installStage = stage;
        this.installError = error;
    }
}

export class DebugInstaller
{
    private _util: CoreClrDebugUtil = null;
    private _isOffline;
    
    constructor(util: CoreClrDebugUtil, isOffline?: boolean) {
        this._util = util;
        this._isOffline = isOffline || false;
    }

    public install(runtimeId: string): Promise<void> {
        let installStage = 'writeProjectJson';
        return this.writeProjectJson(runtimeId).then(() => {
            installStage = 'dotnetRestore';
            return this.spawnChildProcess('dotnet', ['--verbose', 'restore', '--configfile', 'NuGet.config'], this._util.coreClrDebugDir());
        }).then(() => {
            installStage = "dotnetPublish";
            return this.spawnChildProcess('dotnet', ['--verbose', 'publish', '-r', runtimeId, '-o', this._util.debugAdapterDir()], this._util.coreClrDebugDir());
        }).then(() => {
            installStage = "ensureAd7";
            return this.ensureAd7EngineExists(this._util.debugAdapterDir());
        }).then(() => {
            installStage = "renameDummyEntrypoint";
            return this.renameDummyEntrypoint();
        }).then(() => {
            installStage = "rewriteManifest";
            this.rewriteManifest();
            installStage = "writeCompletionFile";
            return this.writeCompletionFile();
        }).catch((error) => {
           throw new InstallError(installStage, error.toString()); 
        });
    }

    public clean(): void {
        let cleanItems: string[] = [];

        cleanItems.push(this._util.debugAdapterDir());
        cleanItems.push(this._util.installLogPath());
        cleanItems.push(path.join(this._util.coreClrDebugDir(), "bin"));
        cleanItems.push(path.join(this._util.coreClrDebugDir(), "obj"));
        cleanItems.push(path.join(this._util.coreClrDebugDir(), 'project.json'));
        cleanItems.push(path.join(this._util.coreClrDebugDir(), 'project.lock.json'));

        cleanItems.forEach((item) => {
            if (CoreClrDebugUtil.existsSync(item)) {
                this._util.log(`Cleaning ${item}`);
                fs_extra.removeSync(item);
            }
        });
    }

    private rewriteManifest() : void {
        const manifestPath = path.join(this._util.extensionDir(), 'package.json');
        let manifestString = fs.readFileSync(manifestPath, 'utf8');
        let manifestObject = JSON.parse(manifestString);
        delete manifestObject.contributes.debuggers[0].runtime;
        delete manifestObject.contributes.debuggers[0].program;

        let programString = './coreclr-debug/debugAdapters/OpenDebugAD7';
        manifestObject.contributes.debuggers[0].windows = { program: programString + '.exe' };
        manifestObject.contributes.debuggers[0].osx = { program: programString };
        manifestObject.contributes.debuggers[0].linux = { program: programString };

        manifestString = JSON.stringify(manifestObject, null, 2);
        fs.writeFileSync(manifestPath, manifestString);
    }

    private writeCompletionFile() : Promise<void> {
        return CoreClrDebugUtil.writeEmptyFile(this._util.installCompleteFilePath());
    }

    private renameDummyEntrypoint() : Promise<void> {
        let src = path.join(this._util.debugAdapterDir(), 'dummy');
        let dest = path.join(this._util.debugAdapterDir(), 'OpenDebugAD7');

        if (!CoreClrDebugUtil.existsSync(src)) {
            if (CoreClrDebugUtil.existsSync(src + '.exe')) {
                src += '.exe';
                dest += '.exe';
            }
        }

        const promise = new Promise<void>((resolve, reject) => {
            fs.rename(src, dest, (err) => {
                if (err) {
                    reject(err.code);
                } else {
                    resolve();
                }
            });
        });
        
        return promise;
    }

    private ensureAd7EngineExists(outputDirectory: string) : Promise<void> {
        let filePath = path.join(outputDirectory, "coreclr.ad7Engine.json");
        return new Promise<void>((resolve, reject) => {
            fs.exists(filePath, (exists) => {
                if (exists) {
                    return resolve();
                } else {
                    this._util.log(`${filePath} does not exist.`);
                    this._util.log('');
                    // NOTE: The minimum build number is actually less than 1584, but this is the minimum
                    // build that I have tested.
                    this._util.log("Error: The .NET CLI did not correctly restore debugger files. Ensure that you have .NET CLI version 1.0.0 build #001584 or newer. You can check your .NET CLI version using 'dotnet --version'.");
                    return reject("The .NET CLI did not correctly restore debugger files.");
                }
            });
        });
    }

    private writeProjectJson(runtimeId: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const projectJsonPath = path.join(this._util.coreClrDebugDir(), 'project.json');
            this._util.log('Creating ' + projectJsonPath);

            const projectJson = this.createProjectJson(runtimeId);

            fs.writeFile(projectJsonPath, JSON.stringify(projectJson, null, 2), {encoding: 'utf8'}, (err) => {
                if (err) {
                    this._util.log('Error: Unable to write to project.json: ' + err.message);
                    reject(err.code);
                }
                else {
                    resolve();
                }
            });
        });
    }

    private createProjectJson(targetRuntime: string): any
    {
        let projectJson = {
            name: "dummy",
            buildOptions: {
                emitEntryPoint: true
            },
            dependencies: {
                "Microsoft.VisualStudio.clrdbg": "14.0.25406-preview-3044032",
                "Microsoft.VisualStudio.clrdbg.MIEngine": "14.0.30610-preview-1",
                "Microsoft.VisualStudio.OpenDebugAD7": "1.0.20614-preview-2",
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
                "netcoreapp1.0": {
                    imports: [ "dnxcore50", "portable-net45+win8" ]
                }
            },
            runtimes: {
            }
        };

        projectJson.runtimes[targetRuntime] = {};

        if (this._isOffline) {
            projectJson.dependencies["Microsoft.NetCore.DotNetHostPolicy"] = "1.0.1-rc-002702";
        }

        return projectJson;
    }

    private spawnChildProcess(process: string, args: string[], workingDirectory: string) : Promise<void> {
        const promise = new Promise<void>((resolve, reject) => {
            const child = child_process.spawn(process, args, {cwd: workingDirectory});

            child.stdout.on('data', (data) => {
                this._util.log(`${data}`);
            });

            child.stderr.on('data', (data) => {
                this._util.log(`Error: ${data}`);
            });

            child.on('close', (code: number) => {
                if (code != 0) {
                    this._util.log(`${process} exited with error code ${code}`);
                    reject(new Error(code.toString()));    
                }
                else {
                    resolve();
                }
            });
        });

        return promise;
    }
}
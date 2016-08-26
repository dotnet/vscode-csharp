/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CoreClrDebugUtil } from './util';
import * as fs from 'fs';
import * as path from 'path';
import * as fs_extra from 'fs-extra-promise';

export class InstallError extends Error {
    public installStage: string;

    private _errorMessage: string;
    private _hasMoreErrors: boolean;

    public get hasMoreErrors(): boolean {
        return this._hasMoreErrors;
    }

    public get errorMessage(): string {
        return this._errorMessage;
    }

    public set errorMessage(message: string) {
        if (this._errorMessage !== null) {
            // Take note that we're overwriting a previous error.
            this._hasMoreErrors = true;
        }
        this._errorMessage = message;
    }

    constructor() {
        super('Error during installation.');
        this._errorMessage = null;
        this._hasMoreErrors = false;
    }

    public setHasMoreErrors(): void {
        this._hasMoreErrors = true;
    }
}

export class DebugInstaller {
    private _util: CoreClrDebugUtil = null;
    private _isOffline;

    constructor(util: CoreClrDebugUtil, isOffline?: boolean) {
        this._util = util;
        this._isOffline = isOffline || false;
    }

    public install(runtimeId: string): Promise<void> {
        let errorBuilder: InstallError = new InstallError();
        errorBuilder.installStage = 'writeProjectJson';

        return this.writeProjectJson(runtimeId).then(() => {
            errorBuilder.installStage = 'dotnetRestore';
            return this._util.spawnChildProcess('dotnet', ['--verbose', 'restore', '--configfile', 'NuGet.config'], this._util.coreClrDebugDir(),
                (data: Buffer) => {
                    let text: string = data.toString();
                    this._util.logRaw(text);

                    // Certain errors are only logged to stdout.
                    // Detect these and make a note of the kind of error.
                    DebugInstaller.parseRestoreErrors(text, errorBuilder);
                },
                (data: Buffer) => {
                    let text: string = data.toString();
                    this._util.logRaw(text);

                    // Reference errors are sent to stderr at the end of restore.
                    DebugInstaller.parseReferenceErrors(text, errorBuilder);
                });
        }).then(() => {
            errorBuilder.installStage = 'dotnetPublish';
            return this._util.spawnChildProcess('dotnet', ['--verbose', 'publish', '-r', runtimeId, '-o', this._util.debugAdapterDir()], this._util.coreClrDebugDir(),
                (data: Buffer) => {
                    let text: string = data.toString();
                    this._util.logRaw(text);

                    DebugInstaller.parsePublishErrors(text, errorBuilder);
            });
        }).then(() => {
            errorBuilder.installStage = 'ensureAd7';
            return this.ensureAd7EngineExists(this._util.debugAdapterDir());
        }).then(() => {
            errorBuilder.installStage = 'renameDummyEntrypoint';
            return this.renameDummyEntrypoint();
        }).then(() => {
            errorBuilder.installStage = 'rewriteManifest';
            this.rewriteManifest();
            errorBuilder.installStage = 'writeCompletionFile';
            return this.writeCompletionFile();
        }).catch((e) => {
            if (errorBuilder.errorMessage === null) {
                // Only give the error message if we don't have any better info,
                // as this is usually something similar to "Error: 1".
                errorBuilder.errorMessage = e;
            }

            throw errorBuilder;
        });
    }

    public clean(): void {
        let cleanItems: string[] = [];

        cleanItems.push(this._util.debugAdapterDir());
        cleanItems.push(this._util.installLogPath());
        cleanItems.push(path.join(this._util.coreClrDebugDir(), 'bin'));
        cleanItems.push(path.join(this._util.coreClrDebugDir(), 'obj'));
        cleanItems.push(path.join(this._util.coreClrDebugDir(), 'project.json'));
        cleanItems.push(path.join(this._util.coreClrDebugDir(), 'project.lock.json'));

        cleanItems.forEach((item) => {
            if (CoreClrDebugUtil.existsSync(item)) {
                this._util.log(`Cleaning ${item}`);
                fs_extra.removeSync(item);
            }
        });
    }

    private rewriteManifest(): void {
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

    private writeCompletionFile(): Promise<void> {
        return CoreClrDebugUtil.writeEmptyFile(this._util.installCompleteFilePath());
    }

    private renameDummyEntrypoint(): Promise<void> {
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

    private ensureAd7EngineExists(outputDirectory: string): Promise<void> {
        let filePath = path.join(outputDirectory, 'coreclr.ad7Engine.json');
        return new Promise<void>((resolve, reject) => {
            fs.exists(filePath, (exists) => {
                if (exists) {
                    return resolve();
                } else {
                    this._util.log(`${filePath} does not exist.`);
                    this._util.log('');
                    // NOTE: The minimum build number is actually less than 1584, but this is the minimum tested build.
                    this._util.log('Error: The .NET CLI did not correctly restore debugger files. ' +
                        'Ensure that you have .NET CLI version 1.0.0 build #001584 or newer. ' +
                        "You can check your .NET CLI version using 'dotnet --version'.");
                    return reject('The .NET CLI did not correctly restore debugger files.');
                }
            });
        });
    }

    private writeProjectJson(runtimeId: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const projectJsonPath = path.join(this._util.coreClrDebugDir(), 'project.json');
            this._util.log('Creating ' + projectJsonPath);

            const projectJson = this.createProjectJson(runtimeId);

            fs.writeFile(projectJsonPath, JSON.stringify(projectJson, null, 2), { encoding: 'utf8' }, (err) => {
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

    private createProjectJson(targetRuntime: string): any {
        let projectJson = {
            name: "dummy",
            buildOptions: {
                emitEntryPoint: true
            },
            dependencies: {
                "Microsoft.VisualStudio.clrdbg": "15.0.25623-preview-3209250",
                "Microsoft.VisualStudio.clrdbg.MIEngine": "14.0.30822-preview-1",
                "Microsoft.VisualStudio.OpenDebugAD7": "1.0.20822-preview-1",
                "NETStandard.Library": "1.6.0",
                "Newtonsoft.Json": "7.0.1",
                "Microsoft.VisualStudio.Debugger.Interop.Portable": "1.0.1",
                "System.Collections.Specialized": "4.0.1",
                "System.Collections.Immutable": "1.2.0",
                "System.Diagnostics.Process": "4.1.0",
                "System.Dynamic.Runtime": "4.0.11",
                "Microsoft.CSharp": "4.0.1",
                "System.Threading.Tasks.Dataflow": "4.6.0",
                "System.Threading.Thread": "4.0.0",
                "System.Xml.XDocument": "4.0.11",
                "System.Xml.XmlDocument": "4.0.1",
                "System.Xml.XmlSerializer": "4.0.11",
                "System.ComponentModel": "4.0.1",
                "System.ComponentModel.Annotations": "4.1.0",
                "System.ComponentModel.EventBasedAsync": "4.0.11",
                "System.Runtime.Serialization.Primitives": "4.1.1",
                "System.Net.Http": "4.1.0"
            },
            frameworks: {
                "netcoreapp1.0": {
                    imports: ["dnxcore50", "portable-net45+win8"]
                }
            },
            runtimes: {
            }
        };

        projectJson.runtimes[targetRuntime] = {};

        if (this._isOffline) {
            projectJson.dependencies["Microsoft.NetCore.DotNetHostPolicy"] = "1.0.1";
        }

        return projectJson;
    }

    private static parseRestoreErrors(output: string, errorBuilder: InstallError): void {
        let lines: string[] = output.replace(/\r/mg, '').split('\n');
        lines.forEach(line => {
            if (line.startsWith('error')) {
                const connectionError: string = 'The server name or address could not be resolved';
                if (line.indexOf(connectionError) !== -1) {
                    errorBuilder.errorMessage = connectionError;
                }

                const parseVersionError: RegExp = /Error reading '.*' at line [0-9]+ column [0-9]+: '.*' is not a valid version string/;
                if (parseVersionError.test(line)) {
                    errorBuilder.errorMessage = 'Invalid version string';
                }
            }
        });
    }

    private static parseReferenceErrors(output: string, errorBuilder: InstallError): void {
        // Reference errors are restated at the end of the output. Find this section first.
        let errorRegionRegExp: RegExp = /^Errors in .*project\.json$/gm;
        let beginIndex: number = output.search(errorRegionRegExp);
        let errorBlock: string = output.slice(beginIndex);

        let lines: string[] = errorBlock.replace(/\r/mg, '').split('\n');
        lines.forEach(line => {
            let referenceRegExp: RegExp = /^(?:\t|\ \ \ \ )Unable to resolve '([^']+)'/g;
            let match: RegExpMatchArray;
            while (match = referenceRegExp.exec(line)) {
                let reference: string = match[1];
                if (reference.startsWith('Microsoft') ||
                    reference.startsWith('System') ||
                    reference.startsWith('NETStandard') ||
                    reference.startsWith('Newtonsoft')) {
                    errorBuilder.errorMessage = `Unable to restore reference '${reference}'`;
                } else {
                    errorBuilder.errorMessage = 'Error(s) encountered restoring private references';
                }
            }
        });
    }

    private static parsePublishErrors(output: string, errorBuilder: InstallError): void {
        let lines: string[] = output.replace(/\r/mg, '').split('\n');
        lines.forEach(line => {
            const errorTypeRegExp: RegExp = /^([\w\.]+Exception)/g;
            let typeMatch: RegExpMatchArray;
            while (typeMatch = errorTypeRegExp.exec(line)) {
                let type: string = typeMatch[1];
                if (type === 'System.IO.IOException') {
                    const ioExceptionRegExp: RegExp = /System\.IO\.IOException: The process cannot access the file '(.*)' because it is being used by another process./g;
                    let ioMatch: RegExpMatchArray;
                    if (ioMatch = ioExceptionRegExp.exec(line)) {
                        // Remove path as it may contain user information.
                        errorBuilder.errorMessage = `System.IO.IOException: unable to access '${path.basename(ioMatch[1])}'`;
                    }
                } else {
                    errorBuilder.errorMessage = type;
                }
            }
        });
    }
}
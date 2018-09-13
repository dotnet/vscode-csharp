/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { satisfies } from 'semver';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { Options } from './options';

//This interface defines the mono being used by the omnisharp process
export class MonoInformation {
    
    constructor(public version: string, public isValid: boolean, public path: string) {
    }

    public useGlobalMono(options: Options) {
        if (options.useGlobalMono === "always") {
            if (!this.isValid) {
                throw new Error('Cannot start OmniSharp because Mono version >=5.8.1 is required.');
            }

            return true;
        }
        else if (options.useGlobalMono === "auto" && this.isValid) {
            return true;
        }

        return false;
    }
}

export async function getValidMonoInfo(environment: NodeJS.ProcessEnv, useGlobalMono: string, monoPath: string): Promise<MonoInformation> {
    configureAlternativeMono(environment, useGlobalMono, monoPath);
    let version = await getMonoVersion(environment);
    
    return new MonoInformation(
        version,
        satisfies(version, '>=5.8.1'),
        monoPath,
    );
}

function configureAlternativeMono(childEnv: NodeJS.ProcessEnv, useGlobalMono: string, monoPath: string) {
    if (useGlobalMono !== "never" && monoPath !== undefined) {
        childEnv['PATH'] = path.join(monoPath, 'bin') + path.delimiter + childEnv['PATH'];
        childEnv['MONO_GAC_PREFIX'] = monoPath;
    }
}

async function getMonoVersion(environment: NodeJS.ProcessEnv): Promise<string> {
    const versionRegexp = /(\d+\.\d+\.\d+)/;

    return new Promise<string>((resolve, reject) => {
        let childprocess: ChildProcess;
        try {
            childprocess = spawn('mono', ['--version'], { env: environment });
        }
        catch (e) {
            return resolve(undefined);
        }

        childprocess.on('error', function (err: any) {
            resolve(undefined);
        });

        let stdout = '';
        childprocess.stdout.on('data', (data: NodeBuffer) => {
            stdout += data.toString();
        });

        childprocess.stdout.on('close', () => {
            let match = versionRegexp.exec(stdout);

            if (match && match.length > 1) {
                resolve(match[1]);
            }
            else {
                resolve(undefined);
            }
        });
    });
}
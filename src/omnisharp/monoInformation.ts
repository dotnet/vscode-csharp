/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { satisfies } from 'semver';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { Options } from './options';

//This interface defines the mono being used by the omnisharp process
export interface MonoInformation {
    version: string;
    path: string;
}

export function shouldUseGlobalMono(options: Options, monoInfo: MonoInformation): boolean{
    let isValid = satisfies(monoInfo.version, ">=5.8.1");
    
    if (options.useGlobalMono === "always") {
        if (isValid) {
            throw new Error('Cannot start OmniSharp because Mono version >=5.8.1 is required.');
        }

        return true;
    }
    else if (options.useGlobalMono === "auto" && isValid) {
        return true;
    }

    return false;
}

export async function getGlobalMonoInfo(environment: NodeJS.ProcessEnv, options: Options): Promise<MonoInformation> {
    let path = configureCustomMono(environment, options);
    let version = await getMonoVersion(environment);
    
    return {
        version,
        path
    };
}

function configureCustomMono(childEnv: NodeJS.ProcessEnv, options: Options): string {
    if (options.useGlobalMono !== "never" && options.monoPath !== undefined) {
        childEnv['PATH'] = path.join(options.monoPath, 'bin') + path.delimiter + childEnv['PATH'];
        childEnv['MONO_GAC_PREFIX'] = options.monoPath;
        return options.monoPath;
    }

    return undefined;
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
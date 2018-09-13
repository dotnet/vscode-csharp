/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { satisfies } from 'semver';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

//This interface defines the mono being used by the omnisharp process
export interface MonoInformation {
    version: string;
    path?: string;
}

export async function getValidMonoInfo(environment: NodeJS.ProcessEnv, useGlobalMono: string, monoPath: string): Promise<MonoInformation> {
    configureAlternativeMono(environment, useGlobalMono, monoPath);
    let version = await getMonoVersion(environment);
    if (satisfies(version, '>=5.8.1')) {
        return {
            version,
            path: monoPath
        };
    }
    
    return undefined;
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
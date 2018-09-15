/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { satisfies } from 'semver';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { Options } from './options';
import { IMonoResolver } from './constants/IMonoResolver';
import { MonoInformation } from './constants/MonoInformation';

//This interface defines the mono being used by the omnisharp process

export class OmniSharpMonoResolver implements IMonoResolver{ 
    private minimumMonoVersion = "5.8.1";
    constructor(private getMonoVersion: (env: NodeJS.ProcessEnv) => Promise<string>) {
    }

    private async getGlobalMono(options: Options): Promise<MonoInformation> {
        let childEnv = { ...process.env };
        let path = configureCustomMono(childEnv, options);
        let version = await this.getMonoVersion(childEnv);

        return {
            version,
            path
        };
    }

    public async shouldUseGlobalMono(options: Options): Promise<MonoInformation> {
        let monoInfo = await this.getGlobalMono(options);
        let isValid = monoInfo.version && satisfies(monoInfo.version, `>=${this.minimumMonoVersion}`);

        if (options.useGlobalMono === "always") {
            if (!isValid) {
                throw new Error(`Cannot start OmniSharp because Mono version >=${this.minimumMonoVersion} is required.`);
            }

            return monoInfo;
        }
        else if (options.useGlobalMono === "auto" && isValid) {
            return monoInfo;
        }

        return undefined;
    }
}

function configureCustomMono(childEnv: NodeJS.ProcessEnv, options: Options): string {
    if (options.useGlobalMono !== "never" && options.monoPath !== undefined) {
        childEnv['PATH'] = path.join(options.monoPath, 'bin') + path.delimiter + childEnv['PATH'];
        childEnv['MONO_GAC_PREFIX'] = options.monoPath;
        return options.monoPath;
    }

    return undefined;
}

export async function getMonoVersion( environment: NodeJS.ProcessEnv): Promise<string> {
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
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

export class OmniSharpMonoResolver{
    public globalMonoInfo: MonoInformation;
    public minimumMonoVersion = "5.8.1";
    
    constructor(private options: Options, public environment: NodeJS.ProcessEnv) {
    }

    public async setGlobalMonoInfo(){
        let path = configureCustomMono(this.environment, this.options);
        let version = await getMonoVersion(this.environment);
        
        this.globalMonoInfo = {
            version,
            path
        };
    }

    public async shouldUseGlobalMono(): Promise<boolean>{
        await this.setGlobalMonoInfo();
        let isValid = satisfies(this.globalMonoInfo.version, `>=${this.minimumMonoVersion}`);
        
        if (this.options.useGlobalMono === "always") {
            if (isValid) {
                throw new Error(`Cannot start OmniSharp because Mono version >=${this.minimumMonoVersion} is required.`);
            }
    
            return true;
        }
        else if (this.options.useGlobalMono === "auto" && isValid) {
            return true;
        }
    
        return false;
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
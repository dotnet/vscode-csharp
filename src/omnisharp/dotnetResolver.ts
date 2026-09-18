/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import { promisify } from 'util';
import { HostExecutableInformation } from '../shared/constants/hostExecutableInformation';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';
import { PlatformInformation } from '../shared/platform';
import { omnisharpOptions } from '../shared/options';

type ExecuteDotnetVersion = (dotnetExecutable: string, env: NodeJS.ProcessEnv) => Promise<string>;

async function executeDotnetVersion(dotnetExecutable: string, env: NodeJS.ProcessEnv): Promise<string> {
    const result = await promisify(execFile)(dotnetExecutable, ['--version'], { env, encoding: 'utf8' });
    if (result.stderr) {
        throw new Error(`Unable to read dotnet version information. Error ${result.stderr}`);
    }

    return result.stdout;
}

export class DotnetResolver implements IHostExecutableResolver {
    private readonly minimumDotnetVersion = '10.0.0';
    private hostExecutableInfo: Promise<HostExecutableInformation> | undefined;

    constructor(
        private platformInfo: PlatformInformation,
        private executeVersion: ExecuteDotnetVersion = executeDotnetVersion
    ) {}

    public async getHostExecutableInfo(): Promise<HostExecutableInformation> {
        this.hostExecutableInfo ??= this.resolveHostExecutableInfo();
        return this.hostExecutableInfo;
    }

    private async resolveHostExecutableInfo(): Promise<HostExecutableInformation> {
        const dotnet = this.platformInfo.isWindows() ? 'dotnet.exe' : 'dotnet';
        const env = { ...process.env };

        const dotnetPathOption = omnisharpOptions.dotnetPath;
        let dotnetExecutable = dotnet;
        if (dotnetPathOption.length > 0) {
            env['PATH'] = dotnetPathOption + path.delimiter + env['PATH'];
            dotnetExecutable = path.join(dotnetPathOption, dotnet);
            if (!fs.existsSync(dotnetExecutable)) {
                throw new Error(`The configured OmniSharp .NET host does not exist: ${dotnetExecutable}`);
            }
        }

        const version = (await this.executeVersion(dotnetExecutable, env)).trim();
        const dotnetVersion = semver.parse(version);
        if (!dotnetVersion) {
            throw new Error(`Unknown result output from 'dotnet --version'. Received ${version}`);
        }

        if (semver.lt(dotnetVersion, this.minimumDotnetVersion)) {
            throw new Error(
                `Found dotnet version ${dotnetVersion}. Minimum required version is ${this.minimumDotnetVersion}.`
            );
        }

        return {
            version,
            path: dotnetExecutable,
            env,
        };
    }
}

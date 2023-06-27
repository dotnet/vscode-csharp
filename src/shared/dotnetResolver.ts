/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { exec } from 'child_process';
import * as path from 'path';
import * as semver from 'semver';
import { promisify } from 'util';
import { HostExecutableInformation } from './constants/hostExecutableInformation';
import { IHostExecutableResolver } from './constants/IHostExecutableResolver';
import { Options } from './options';
import { PlatformInformation } from './platform';

export class DotnetResolver implements IHostExecutableResolver {
    private readonly minimumDotnetVersion = '6.0.100';

    constructor(private platformInfo: PlatformInformation) {}

    public async getHostExecutableInfo(options: Options): Promise<HostExecutableInformation> {
        const dotnet = this.platformInfo.isWindows() ? 'dotnet.exe' : 'dotnet';
        const env = { ...process.env };

        if (options.commonOptions.dotnetPath.length > 0) {
            env['PATH'] = options.commonOptions.dotnetPath + path.delimiter + env['PATH'];
        }

        // Test the dotnet exe for version
        const result = await promisify(exec)(`${dotnet} --version`, { env });

        if (result.stderr) {
            throw new Error(`Unable to read dotnet version information. Error ${result.stderr}`);
        }

        const dotnetVersion = semver.parse(result.stdout.trimEnd());
        if (!dotnetVersion) {
            throw new Error(`Unknown result output from 'dotnet --version'. Received ${result.stdout}`);
        }

        if (semver.lt(dotnetVersion, this.minimumDotnetVersion)) {
            throw new Error(
                `Found dotnet version ${dotnetVersion}. Minimum required version is ${this.minimumDotnetVersion}.`
            );
        }

        return {
            version: result.stdout,
            path: options.commonOptions.dotnetPath,
            env,
        };
    }
}

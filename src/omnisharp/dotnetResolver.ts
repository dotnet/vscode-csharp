/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';
import * as semver from 'semver';
import { promisify } from 'util';
import { HostExecutableInformation } from '../shared/constants/hostExecutableInformation';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';
import { PlatformInformation } from '../shared/platform';
import { commonOptions } from '../shared/options';

export class DotnetResolver implements IHostExecutableResolver {
    private readonly minimumDotnetVersion = '6.0.100';

    constructor(private platformInfo: PlatformInformation) {}

    public async getHostExecutableInfo(): Promise<HostExecutableInformation> {
        const dotnet = this.platformInfo.isWindows() ? 'dotnet.exe' : 'dotnet';
        const env = { ...process.env };

        const dotnetPathOption = commonOptions.dotnetPath.getValue(vscode);
        if (dotnetPathOption.length > 0) {
            env['PATH'] = dotnetPathOption + path.delimiter + env['PATH'];
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
            path: dotnetPathOption,
            env,
        };
    }
}

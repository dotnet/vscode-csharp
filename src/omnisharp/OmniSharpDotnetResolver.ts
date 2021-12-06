/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { exec } from "child_process";
import * as path from 'path';
import { promisify } from "util";
import { HostExecutableInformation } from "../constants/HostExecutableInformation";
import { IHostExecutableResolver } from "../constants/IHostExecutableResolver";
import { PlatformInformation } from "../platform";
import { Options } from "./options";

const minimumDotnetMajor = 6;
const minimumDotnetMinor = 0;
const minimumDotnetPatch = 100;

export class OmniSharpDotnetResolver implements IHostExecutableResolver {

    constructor(private platformInfo: PlatformInformation) { }

    public async getHostExecutableInfo(options: Options): Promise<HostExecutableInformation> {
        const dotnet = this.platformInfo.isWindows() ? 'dotnet.exe' : 'dotnet';
        const env = { ...process.env };

        if (options.dotnetPath) {
            env['PATH'] = options.dotnetPath + path.delimiter + env['PATH'];
        }

        // Test the dotnet exe for version
        const result = await promisify(exec)(`${dotnet} --version`, { env });

        if (result.stderr) {
            throw new Error(`Unable to read dotnet version information. Error ${result.stderr}`);
        }

        const segments = result.stdout.split('.').map(str => Number.parseInt(str));
        if (segments.length != 3) {
            throw new Error(`Unknown result output from 'dotnet --version'. Received ${result.stdout}`);
        }

        if (this.versionPartIsGreaterThanMinimum(segments[0], minimumDotnetMajor, result.stdout)
            || this.versionPartIsGreaterThanMinimum(segments[1], minimumDotnetMinor, result.stdout)) {
            return {
                version: result.stdout,
                path: options.dotnetPath,
                env
            };
        }

        this.versionPartIsGreaterThanMinimum(segments[2], minimumDotnetPatch, result.stdout);

        return {
            version: result.stdout,
            path: options.dotnetPath,
            env
        };
    }

    private versionPartIsGreaterThanMinimum(actualVersion: number, minimumRequired: number, foundVersion: string): boolean {
        if (actualVersion < minimumRequired) {
            throw new Error(`Found dotnet version ${foundVersion}. Minimum required version is ${minimumDotnetMajor}.${minimumDotnetMinor}.${minimumDotnetPatch}.`);
        }

        return actualVersion > minimumRequired;
    }
}

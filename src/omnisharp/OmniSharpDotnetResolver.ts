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

        const segments: number[] = [];
        const stdoutSplit = result.stdout.split('.');
        if (stdoutSplit.length != 3) {
            throw new Error(`Unknown result output from 'dotnet --version'. Received ${result.stdout}`);
        }

        let isPrerelease = false;

        for (let i = 0; i < 3; i++) {
            let segment = stdoutSplit[i];
            if (i === 2) {
                const dashIndex = segment.indexOf('-');
                if (dashIndex !== -1) {
                    isPrerelease = true;
                    segment = segment.substring(0, dashIndex);
                }
            }

            segments.push(Number.parseInt(segment));
        }


        if (this.versionPartIsGreaterThanMinimum(segments[0], minimumDotnetMajor, result.stdout)
            || this.versionPartIsGreaterThanMinimum(segments[1], minimumDotnetMinor, result.stdout)) {
            return {
                version: result.stdout,
                path: options.dotnetPath,
                env
            };
        }

        // If the found SDK is a pre-release version of .NET, then we need to ensure that it's a _higher_ patch version than the required
        // minimum, not a prerelease version of the required minimum.
        this.versionPartIsGreaterThanMinimum(segments[2], minimumDotnetPatch, result.stdout, /*disallowExactMatch*/ isPrerelease);

        return {
            version: result.stdout,
            path: options.dotnetPath,
            env
        };
    }

    private versionPartIsGreaterThanMinimum(actualVersion: number, minimumRequired: number, foundVersion: string, disallowExactMatch: boolean = false): boolean {
        if (actualVersion < minimumRequired || (disallowExactMatch && actualVersion === minimumRequired)) {
            throw new Error(`Found dotnet version ${foundVersion}. Minimum required version is ${minimumDotnetMajor}.${minimumDotnetMinor}.${minimumDotnetPatch}.`);
        }

        return actualVersion > minimumRequired;
    }
}

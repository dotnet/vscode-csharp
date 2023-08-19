/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as semver from 'semver';
import { join } from 'path';
import { execChildProcess } from '../../common';
import { CoreClrDebugUtil } from '../../coreclrDebug/util';
import { DotnetInfo } from './dotnetInfo';

// This function calls `dotnet --info` and returns the result as a DotnetInfo object.
export async function getDotnetInfo(dotNetCliPaths: string[]): Promise<DotnetInfo> {
    const dotnetExecutablePath = getDotNetExecutablePath(dotNetCliPaths);

    try {
        const env = {
            ...process.env,
            DOTNET_CLI_UI_LANGUAGE: 'en-US',
        };
        const data = await execChildProcess(`${dotnetExecutablePath ?? 'dotnet'} --info`, process.cwd(), env);

        const cliPath = dotnetExecutablePath;
        const fullInfo = data;

        let version: string | undefined;
        let runtimeId: string | undefined;
        let architecture: string | undefined;

        let lines = data.replace(/\r/gm, '').split('\n');
        for (const line of lines) {
            let match: RegExpMatchArray | null;
            if ((match = /^\s*Version:\s*([^\s].*)$/.exec(line))) {
                version = match[1];
            } else if ((match = /^ RID:\s*([\w\-.]+)$/.exec(line))) {
                runtimeId = match[1];
            } else if ((match = /^\s*Architecture:\s*(.*)/.exec(line))) {
                architecture = match[1];
            }
        }

        const runtimeVersions: { [runtime: string]: semver.SemVer[] } = {};
        const listRuntimes = await execChildProcess('dotnet --list-runtimes', process.cwd(), process.env);
        lines = listRuntimes.split(/\r?\n/);
        for (const line of lines) {
            let match: RegExpMatchArray | null;
            if ((match = /^([\w.]+) ([^ ]+) \[([^\]]+)\]$/.exec(line))) {
                const runtime = match[1];
                const runtimeVersion = match[2];
                if (runtime in runtimeVersions) {
                    runtimeVersions[runtime].push(semver.parse(runtimeVersion)!);
                } else {
                    runtimeVersions[runtime] = [semver.parse(runtimeVersion)!];
                }
            }
        }

        if (version !== undefined) {
            const dotnetInfo: DotnetInfo = {
                CliPath: cliPath,
                FullInfo: fullInfo,
                Version: version,
                RuntimeId: runtimeId,
                Architecture: architecture,
                Runtimes: runtimeVersions,
            };
            return dotnetInfo;
        }

        throw new Error('Failed to parse dotnet version information');
    } catch {
        // something went wrong with spawning 'dotnet --info'
        throw new Error('A valid dotnet installation could not be found');
    }
}

export function getDotNetExecutablePath(dotNetCliPaths: string[]): string | undefined {
    const dotnetExeName = `dotnet${CoreClrDebugUtil.getPlatformExeExtension()}`;
    let dotnetExecutablePath: string | undefined;

    for (const dotnetPath of dotNetCliPaths) {
        const dotnetFullPath = join(dotnetPath, dotnetExeName);
        if (CoreClrDebugUtil.existsSync(dotnetFullPath)) {
            dotnetExecutablePath = dotnetFullPath;
            break;
        }
    }
    return dotnetExecutablePath;
}

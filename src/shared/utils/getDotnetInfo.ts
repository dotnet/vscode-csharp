/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as semver from 'semver';
import { join } from 'path';
import { execChildProcess } from '../../common';
import { CoreClrDebugUtil } from '../../coreclrDebug/util';
import { DotnetInfo, RuntimeInfo } from './dotnetInfo';
import { EOL } from 'os';

// This function calls `dotnet --info` and returns the result as a DotnetInfo object.
export async function getDotnetInfo(
    dotNetCliPaths: string[],
    options?: {
        dotnetExecutablePath?: string;
        environment?: Readonly<Record<string, string | null>>;
    }
): Promise<DotnetInfo> {
    const dotnetExecutablePath = options?.dotnetExecutablePath ?? getDotNetExecutablePath(dotNetCliPaths);
    const environment = applyEnvironment(process.env, options?.environment);

    const data = await runDotnetInfo(dotnetExecutablePath, environment);
    const dotnetInfo = await parseDotnetInfo(data, dotnetExecutablePath, environment);
    return dotnetInfo;
}

function applyEnvironment(
    baseEnvironment: NodeJS.ProcessEnv,
    contribution: Readonly<Record<string, string | null>> | undefined
): NodeJS.ProcessEnv {
    const environment = { ...baseEnvironment };
    for (const [key, value] of Object.entries(contribution ?? {})) {
        for (const existingKey of Object.keys(environment)) {
            const matches =
                process.platform === 'win32' ? existingKey.toUpperCase() === key.toUpperCase() : existingKey === key;
            if (matches) {
                delete environment[existingKey];
            }
        }
        if (value !== null) {
            environment[key] = value;
        }
    }
    return environment;
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

async function runDotnetInfo(
    dotnetExecutablePath: string | undefined,
    environment: NodeJS.ProcessEnv
): Promise<string> {
    try {
        const env = {
            ...environment,
            DOTNET_CLI_UI_LANGUAGE: 'en-US',
        };
        const command = dotnetExecutablePath ? `"${dotnetExecutablePath}"` : 'dotnet';
        const data = await execChildProcess(`${command} --info`, process.cwd(), env);
        return data;
    } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        throw new Error(`Error running dotnet --info: ${message}`, { cause: error });
    }
}

async function parseDotnetInfo(
    dotnetInfo: string,
    dotnetExecutablePath: string | undefined,
    environment: NodeJS.ProcessEnv
): Promise<DotnetInfo> {
    try {
        const cliPath = dotnetExecutablePath;
        const fullInfo = dotnetInfo;

        let version: string | undefined;
        let runtimeId: string | undefined;
        let architecture: string | undefined;

        let lines = dotnetInfo.replace(/\r/gm, '').split('\n');
        for (const line of lines) {
            let match: RegExpMatchArray | null;
            if ((match = /^\s*Version:\s*([^\s].*)$/.exec(line))) {
                version = match[1];
            } else if ((match = /^\s*RID:\s*([\w\-.]+)$/.exec(line))) {
                runtimeId = match[1];
            } else if ((match = /^\s*Architecture:\s*(.*)/.exec(line))) {
                architecture = match[1];
            }
        }

        const runtimeVersions: { [runtime: string]: RuntimeInfo[] } = {};
        const command = dotnetExecutablePath ? `"${dotnetExecutablePath}"` : 'dotnet';
        const listRuntimes = await execChildProcess(`${command} --list-runtimes`, process.cwd(), environment);
        lines = listRuntimes.split(/\r?\n/);
        for (const line of lines) {
            let match: RegExpMatchArray | null;
            if ((match = /^([\w.]+) ([^ ]+) \[([^\]]+)\]$/.exec(line))) {
                const runtime = match[1];
                const runtimeVersion = match[2];
                if (runtime in runtimeVersions) {
                    runtimeVersions[runtime].push({
                        Version: semver.parse(runtimeVersion)!,
                        Path: match[3],
                    });
                } else {
                    runtimeVersions[runtime] = [
                        {
                            Version: semver.parse(runtimeVersion)!,
                            Path: match[3],
                        },
                    ];
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
    } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        throw new Error(`Error parsing dotnet --info: ${message}, raw info was:${EOL}${dotnetInfo}`, { cause: error });
    }
}

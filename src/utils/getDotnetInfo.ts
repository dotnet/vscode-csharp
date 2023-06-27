/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from 'path';
import { execChildProcess } from '../common';
import { CoreClrDebugUtil } from '../coreclrDebug/util';

let _dotnetInfo: DotnetInfo | undefined;

// This function calls `dotnet --info` and returns the result as a DotnetInfo object.
export async function getDotnetInfo(dotNetCliPaths: string[]): Promise<DotnetInfo> {
    if (_dotnetInfo !== undefined) {
        return _dotnetInfo;
    }

    const dotnetExecutablePath = getDotNetExecutablePath(dotNetCliPaths);

    try {
        const data = await execChildProcess(`${dotnetExecutablePath ?? 'dotnet'} --info`, process.cwd(), process.env);

        const cliPath = dotnetExecutablePath;
        const fullInfo = data;

        let version: string | undefined;
        let runtimeId: string | undefined;

        const lines = data.replace(/\r/gm, '').split('\n');
        for (const line of lines) {
            let match: RegExpMatchArray | null;
            if ((match = /^ Version:\s*([^\s].*)$/.exec(line))) {
                version = match[1];
            } else if ((match = /^ RID:\s*([\w\-.]+)$/.exec(line))) {
                runtimeId = match[1];
            }

            if (version !== undefined && runtimeId !== undefined) {
                _dotnetInfo = {
                    CliPath: cliPath,
                    FullInfo: fullInfo,
                    Version: version,
                    RuntimeId: runtimeId,
                };
                return _dotnetInfo;
            }
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

export interface DotnetInfo {
    CliPath?: string;
    FullInfo: string;
    Version: string;
    RuntimeId: string;
}

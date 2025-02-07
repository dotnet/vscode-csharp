/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EOL } from 'os';
import { LogOutputChannel } from 'vscode';

export function getProfilingEnvVars(outputChannel: LogOutputChannel): NodeJS.ProcessEnv {
    let profilingEnvVars = {};
    if (process.env.ROSLYN_DOTNET_EventPipeOutputPath) {
        profilingEnvVars = {
            DOTNET_EnableEventPipe: 1,
            DOTNET_EventPipeConfig: 'Microsoft-Windows-DotNETRuntime:0x1F000080018:5',
            DOTNET_EventPipeOutputPath: process.env.ROSLYN_DOTNET_EventPipeOutputPath,
            DOTNET_ReadyToRun: 0,
            DOTNET_TieredCompilation: 1,
            DOTNET_TC_CallCounting: 0,
            DOTNET_TC_QuickJitForLoops: 1,
            DOTNET_JitCollect64BitCounts: 1,
        };
        outputChannel.trace(`Profiling enabled with:${EOL}${JSON.stringify(profilingEnvVars)}`);
    }

    return profilingEnvVars;
}

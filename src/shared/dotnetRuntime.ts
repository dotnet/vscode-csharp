/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CSharpExtensionId } from '../constants/CSharpExtensionId';
import { PlatformInformation } from './platform';
import { Options } from './options';

export const DotNetRuntimeVersion = '7.0';

interface IDotnetAcquireResult {
    dotnetPath: string;
}

let runtimePath: string | undefined;

/**
 * Acquires the .NET runtime if it is not already present.
 * @returns The path to the .NET runtime
 */
export async function acquireRuntime() {
    if (runtimePath) {
        return runtimePath;
    }

    let status = await vscode.commands.executeCommand<IDotnetAcquireResult>('dotnet.acquireStatus', {
        version: DotNetRuntimeVersion,
        requestingExtensionId: CSharpExtensionId,
    });
    if (status === undefined) {
        await vscode.commands.executeCommand('dotnet.showAcquisitionLog');

        status = await vscode.commands.executeCommand<IDotnetAcquireResult>('dotnet.acquire', {
            version: DotNetRuntimeVersion,
            requestingExtensionId: CSharpExtensionId,
        });
        if (!status?.dotnetPath) {
            throw new Error('Could not resolve the dotnet path!');
        }
    }

    return (runtimePath = status.dotnetPath);
}

/**
 * Acquires the .NET runtime and any other dependencies required to spawn a particular .NET executable.
 * @param path The path to the entrypoint assembly. Typically a .dll.
 * @returns The path to the `dotnet` command to use to spawn the process.
 */
export async function acquireDotNetProcessDependencies(path: string) {
    const dotnetPath = await acquireRuntime();

    const args = [path];
    // This will install any missing Linux dependencies.
    await vscode.commands.executeCommand('dotnet.ensureDotnetDependencies', { command: dotnetPath, arguments: args });

    return dotnetPath;
}

export async function getDotNetProcessInfo(appPath: string, platformInfo: PlatformInformation, options: Options): Promise<[appPath: string, env: NodeJS.ProcessEnv, args: string[]]> {
    let dotnetRuntimePath = options.commonOptions.dotnetPath;
    if (!dotnetRuntimePath) {
        let dotnetPath = await acquireDotNetProcessDependencies(appPath);
        dotnetRuntimePath = path.dirname(dotnetPath);
    }

    // Take care to always run .NET processes on the runtime that we intend.
    // The dotnet.exe we point to should not go looking for other runtimes.
    const env: NodeJS.ProcessEnv =  { ...process.env };
    env.DOTNET_ROOT = dotnetRuntimePath;
    env.DOTNET_MULTILEVEL_LOOKUP = '0';
    // Save user's DOTNET_ROOT env-var value so server can recover the user setting when needed
    env.DOTNET_ROOT_USER = process.env.DOTNET_ROOT ?? 'EMPTY';

    let args: string[] = [ ];
    if (!appPath.endsWith('.dll')) {
        return [appPath, env, args];
    }

    const dotnetFileName = platformInfo.isWindows() ? 'dotnet.exe' : 'dotnet';
    const dotnetPath = path.join(dotnetRuntimePath, dotnetFileName);
    if (!fs.existsSync(dotnetPath)) {
        throw new Error(`Cannot find dotnet path '${dotnetPath}'`);
    }

    args.push(appPath);
    return [dotnetPath, env, args];
}

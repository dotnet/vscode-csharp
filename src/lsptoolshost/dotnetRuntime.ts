/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CSharpExtensionId } from '../constants/csharpExtensionId';

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

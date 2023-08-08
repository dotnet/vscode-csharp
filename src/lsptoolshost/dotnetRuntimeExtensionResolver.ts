/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as semver from 'semver';
import { HostExecutableInformation } from '../shared/constants/hostExecutableInformation';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';
import { PlatformInformation } from '../shared/platform';
import { Options } from '../shared/options';
import { existsSync } from 'fs';
import { CSharpExtensionId } from '../constants/csharpExtensionId';
import { promisify } from 'util';
import { exec } from 'child_process';
import { pathExistsSync } from 'fs-extra';

export const DotNetRuntimeVersion = '7.0';

interface IDotnetAcquireResult {
    dotnetPath: string;
}

/**
 * Resolves the dotnet runtime for a server executable from given options and the dotnet runtime VSCode extension.
 */
export class DotnetRuntimeExtensionResolver implements IHostExecutableResolver {
    private readonly minimumDotnetVersion = '7.0.100';
    constructor(
        private platformInfo: PlatformInformation,
        /**
         * This is a function instead of a string because the server path can change while the extension is active (when the option changes).
         */
        private getServerPath: (options: Options, platform: PlatformInformation) => string,
        private channel: vscode.OutputChannel
    ) {}

    private hostInfo: HostExecutableInformation | undefined;

    async getHostExecutableInfo(options: Options): Promise<HostExecutableInformation> {
        let dotnetRuntimePath = options.commonOptions.dotnetPath;
        const serverPath = this.getServerPath(options, this.platformInfo);

        // Check if we can find a valid dotnet from dotnet --version on the PATH.
        if (!dotnetRuntimePath) {
            const dotnetPath = await this.findDotnetFromPath();
            if (dotnetPath) {
                return {
                    version: '' /* We don't need to know the version - we've already verified its high enough */,
                    path: dotnetPath,
                    env: process.env,
                };
            }
        }

        // We didn't find it on the path, see if we can install the correct runtime using the runtime extension.
        if (!dotnetRuntimePath) {
            const dotnetInfo = await this.acquireDotNetProcessDependencies(serverPath);
            dotnetRuntimePath = path.dirname(dotnetInfo.path);
        }

        const dotnetExecutableName = this.platformInfo.isWindows() ? 'dotnet.exe' : 'dotnet';
        const dotnetExecutablePath = path.join(dotnetRuntimePath, dotnetExecutableName);
        if (!existsSync(dotnetExecutablePath)) {
            throw new Error(`Cannot find dotnet path '${dotnetExecutablePath}'`);
        }

        return {
            version: '' /* We don't need to know the version - we've already downloaded the correct one */,
            path: dotnetExecutablePath,
            env: process.env,
        };
    }

    /**
     * Acquires the .NET runtime if it is not already present.
     * @returns The path to the .NET runtime
     */
    private async acquireRuntime(): Promise<HostExecutableInformation> {
        if (this.hostInfo) {
            return this.hostInfo;
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

        return (this.hostInfo = {
            version: DotNetRuntimeVersion,
            path: status.dotnetPath,
            env: process.env,
        });
    }

    /**
     * Acquires the .NET runtime and any other dependencies required to spawn a particular .NET executable.
     * @param path The path to the entrypoint assembly. Typically a .dll.
     */
    private async acquireDotNetProcessDependencies(path: string): Promise<HostExecutableInformation> {
        const dotnetInfo = await this.acquireRuntime();

        const args = [path];
        // This will install any missing Linux dependencies.
        await vscode.commands.executeCommand('dotnet.ensureDotnetDependencies', {
            command: dotnetInfo.path,
            arguments: args,
        });

        return dotnetInfo;
    }

    /**
     * Checks dotnet --version to see if the value on the path is greater than the minimum required version.
     * This is adapated from similar O# server logic and should be removed when we have a stable acquisition extension.
     * @returns true if the dotnet version is greater than the minimum required version, false otherwise.
     */
    private async findDotnetFromPath(): Promise<string | undefined> {
        try {
            // Run dotnet version to see if there is a valid dotnet on the path with a high enough version.
            const result = await promisify(exec)(`dotnet --version`);

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

            // Find the location of the dotnet on path.
            const command = this.platformInfo.isWindows() ? 'where' : 'which';
            const whereOutput = await promisify(exec)(`${command} dotnet`);
            if (!whereOutput.stdout) {
                throw new Error(`Unable to find dotnet from where.`);
            }

            const path = whereOutput.stdout.trim();
            if (!pathExistsSync(path)) {
                throw new Error(`dotnet path does not exist: ${path}`);
            }

            this.channel.appendLine(`Using dotnet configured on PATH`);
            return path;
        } catch (e) {
            this.channel.appendLine(
                'Failed to find dotnet info from path, falling back to acquire runtime via ms-dotnettools.vscode-dotnet-runtime'
            );
            if (e instanceof Error) {
                this.channel.appendLine(e.message);
            }
        }

        return undefined;
    }
}

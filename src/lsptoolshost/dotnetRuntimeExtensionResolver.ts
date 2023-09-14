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
import { commonOptions } from '../shared/options';
import { existsSync } from 'fs';
import { CSharpExtensionId } from '../constants/csharpExtensionId';
import { promisify } from 'util';
import { exec } from 'child_process';
import { getDotnetInfo } from '../shared/utils/getDotnetInfo';
import { readFile, realpath } from 'fs/promises';

export const DotNetRuntimeVersion = '7.0';

interface IDotnetAcquireResult {
    dotnetPath: string;
}

/**
 * Resolves the dotnet runtime for a server executable from given options and the dotnet runtime VSCode extension.
 */
export class DotnetRuntimeExtensionResolver implements IHostExecutableResolver {
    private readonly minimumDotnetRuntimeVersion = '7.0';
    constructor(
        private platformInfo: PlatformInformation,
        /**
         * This is a function instead of a string because the server path can change while the extension is active (when the option changes).
         */
        private getServerPath: (platform: PlatformInformation) => string,
        private channel: vscode.OutputChannel,
        private extensionPath: string
    ) {}

    private hostInfo: HostExecutableInformation | undefined;

    async getHostExecutableInfo(): Promise<HostExecutableInformation> {
        let dotnetRuntimePath = commonOptions.dotnetPath.getValue(vscode);
        const serverPath = this.getServerPath(this.platformInfo);

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
            const dotnetInfo = await getDotnetInfo([]);

            const extensionArchitecture = await this.getArchitectureFromTargetPlatform();
            const dotnetArchitecture = dotnetInfo.Architecture;

            // If the extension arhcitecture is defined, we check that it matches the dotnet architecture.
            // If its undefined we likely have a platform neutral server and assume it can run on any architecture.
            if (extensionArchitecture && extensionArchitecture !== dotnetArchitecture) {
                throw new Error(
                    `The architecture of the .NET runtime (${dotnetArchitecture}) does not match the architecture of the extension (${extensionArchitecture}).`
                );
            }

            // Verify that the dotnet we found includes a runtime version that is compatible with our requirement.
            const requiredRuntimeVersion = semver.parse(`${this.minimumDotnetRuntimeVersion}.0`);
            if (!requiredRuntimeVersion) {
                throw new Error(`Unable to parse minimum required version ${this.minimumDotnetRuntimeVersion}`);
            }

            const coreRuntimeVersions = dotnetInfo.Runtimes['Microsoft.NETCore.App'];
            let foundRuntimeVersion = false;
            for (const version of coreRuntimeVersions) {
                // We consider a match if the runtime is greater than or equal to the required version since we roll forward.
                if (semver.gt(version, requiredRuntimeVersion)) {
                    foundRuntimeVersion = true;
                    break;
                }
            }

            if (!foundRuntimeVersion) {
                throw new Error(
                    `No compatible .NET runtime found. Minimum required version is ${this.minimumDotnetRuntimeVersion}.`
                );
            }

            // Find the location of the dotnet on path.
            const command = this.platformInfo.isWindows() ? 'where' : 'which';
            const whereOutput = await promisify(exec)(`${command} dotnet`);
            if (!whereOutput.stdout) {
                throw new Error(`Unable to find dotnet from ${command}.`);
            }

            // There could be multiple paths output from where.  Take the first since that is what we used to run dotnet --info.
            const path = whereOutput.stdout.trim().replace(/\r/gm, '').split('\n')[0];
            if (!existsSync(path)) {
                throw new Error(`dotnet path does not exist: ${path}`);
            }

            this.channel.appendLine(`Using dotnet configured on PATH`);

            // If dotnet is just a symlink, resolve it to the actual executable so
            // callers will be able to get the actual directory containing the exe.
            return await realpath(path);
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

    private async getArchitectureFromTargetPlatform(): Promise<string | undefined> {
        const vsixManifestFile = path.join(this.extensionPath, '.vsixmanifest');
        if (!existsSync(vsixManifestFile)) {
            // This is not an error as normal development F5 builds do not generate a .vsixmanifest file.
            this.channel.appendLine(
                `Unable to find extension target platform - no vsix manifest file exists at ${vsixManifestFile}`
            );
            return undefined;
        }

        const contents = await readFile(vsixManifestFile, 'utf-8');
        const targetPlatformMatch = /TargetPlatform="(.*)"/.exec(contents);
        if (!targetPlatformMatch) {
            throw new Error(`Could not find extension target platform in ${vsixManifestFile}`);
        }

        const targetPlatform = targetPlatformMatch[1];

        // The currently known extension platforms are taken from here:
        // https://code.visualstudio.com/api/working-with-extensions/publishing-extension#platformspecific-extensions
        switch (targetPlatform) {
            case 'win32-x64':
            case 'linux-x64':
            case 'alpine-x64':
            case 'darwin-x64':
                return 'x64';
            case 'win32-ia32':
                return 'x86';
            case 'win32-arm64':
            case 'linux-arm64':
            case 'alpine-arm64':
            case 'darwin-arm64':
                return 'arm64';
            case 'linux-armhf':
            case 'web':
                return undefined;
            default:
                throw new Error(`Unknown extension target platform: ${targetPlatform}`);
        }
    }
}

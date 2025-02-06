/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { HostExecutableInformation } from '../../shared/constants/hostExecutableInformation';
import { IHostExecutableResolver } from '../../shared/constants/IHostExecutableResolver';
import { PlatformInformation } from '../../shared/platform';
import { languageServerOptions } from '../../shared/options';
import { existsSync } from 'fs';
import { CSharpExtensionId } from '../../constants/csharpExtensionId';
import { readFile } from 'fs/promises';
import { IDotnetAcquireResult, IDotnetFindPathContext } from './dotnetRuntimeExtensionApi';

const DotNetMajorVersion = '8';
const DotNetMinorVersion = '0';
const DotNetPatchVersion = '10';
export const DotNetRuntimeVersion = `${DotNetMajorVersion}.${DotNetMinorVersion}.${DotNetPatchVersion}`;

/**
 * Resolves the dotnet runtime for a server executable from given options and the dotnet runtime VSCode extension.
 */
export class DotnetRuntimeExtensionResolver implements IHostExecutableResolver {
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
        if (this.hostInfo) {
            return this.hostInfo;
        }

        this.channel.appendLine(`Locating .NET runtime version ${DotNetRuntimeVersion}`);
        const extensionArchitecture = (await this.getArchitectureFromTargetPlatform()) ?? process.arch;
        const findPathRequest: IDotnetFindPathContext = {
            acquireContext: {
                version: DotNetRuntimeVersion,
                requestingExtensionId: CSharpExtensionId,
                architecture: extensionArchitecture,
                mode: 'runtime',
            },
            versionSpecRequirement: 'greater_than_or_equal',
        };
        let acquireResult = await vscode.commands.executeCommand<IDotnetAcquireResult | undefined>(
            'dotnet.findPath',
            findPathRequest
        );
        if (acquireResult === undefined) {
            this.channel.appendLine(
                `Did not find .NET ${DotNetRuntimeVersion} on path, falling back to acquire runtime via ms-dotnettools.vscode-dotnet-runtime`
            );
            acquireResult = await this.acquireDotNetProcessDependencies();
        }

        const dotnetExecutablePath = acquireResult.dotnetPath;

        const hostInfo = {
            version: '' /* We don't need to know the version - we've already downloaded the correct one */,
            path: dotnetExecutablePath,
            env: this.getEnvironmentVariables(dotnetExecutablePath),
        };
        this.hostInfo = hostInfo;
        return hostInfo;
    }

    private getEnvironmentVariables(dotnetExecutablePath: string): NodeJS.ProcessEnv {
        // Take care to always run .NET processes on the runtime that we intend.
        // The dotnet.exe we point to should not go looking for other runtimes.
        const env: NodeJS.ProcessEnv = { ...process.env };
        env.DOTNET_ROOT = path.dirname(dotnetExecutablePath);
        env.DOTNET_MULTILEVEL_LOOKUP = '0';
        // Save user's DOTNET_ROOT env-var value so server can recover the user setting when needed
        env.DOTNET_ROOT_USER = process.env.DOTNET_ROOT ?? 'EMPTY';

        if (languageServerOptions.crashDumpPath) {
            // Enable dump collection
            env.DOTNET_DbgEnableMiniDump = '1';
            // Collect heap dump
            env.DOTNET_DbgMiniDumpType = '2';
            // Collect crashreport.json with additional thread and stack frame information.
            env.DOTNET_EnableCrashReport = '1';
            // The dump file name format is <executable>.<pid>.dmp
            env.DOTNET_DbgMiniDumpName = path.join(languageServerOptions.crashDumpPath, '%e.%p.dmp');
        }

        return env;
    }

    /**
     * Acquires the .NET runtime if it is not already present.
     * @returns The path to the .NET runtime
     */
    private async acquireRuntime(): Promise<IDotnetAcquireResult> {
        // The runtime extension doesn't support specifying a patch versions in the acquire API, so we only use major.minor here.
        // That is generally OK, as acquisition will always acquire the latest patch version.
        const dotnetAcquireVersion = `${DotNetMajorVersion}.${DotNetMinorVersion}`;
        let status = await vscode.commands.executeCommand<IDotnetAcquireResult>('dotnet.acquireStatus', {
            version: dotnetAcquireVersion,
            requestingExtensionId: CSharpExtensionId,
        });
        if (status === undefined) {
            await vscode.commands.executeCommand('dotnet.showAcquisitionLog');

            status = await vscode.commands.executeCommand<IDotnetAcquireResult>('dotnet.acquire', {
                version: dotnetAcquireVersion,
                requestingExtensionId: CSharpExtensionId,
            });
            if (!status) {
                throw new Error('Could not resolve the dotnet path!');
            }
        }

        return status;
    }

    /**
     * Acquires the .NET runtime and any other dependencies required to spawn a particular .NET executable.
     * @param path The path to the entrypoint assembly. Typically a .dll.
     */
    private async acquireDotNetProcessDependencies(): Promise<IDotnetAcquireResult> {
        const acquireResult = await this.acquireRuntime();

        const args = [this.getServerPath(this.platformInfo)];
        // This will install any missing Linux dependencies.
        await vscode.commands.executeCommand('dotnet.ensureDotnetDependencies', {
            command: acquireResult.dotnetPath,
            arguments: args,
        });

        return acquireResult;
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs';
import * as semver from 'semver';
import * as os from 'os';
import { PlatformInformation } from './../platform';
import { getDotnetInfo, DotnetInfo, DOTNET_MISSING_MESSAGE } from '../utils/getDotnetInfo';

const MINIMUM_SUPPORTED_DOTNET_CLI: string = '1.0.0';

export class DotNetCliError extends Error {
    public ErrorMessage: string; // the message to display to the user
    public ErrorString: string; // the string to log for this error
}

export class CoreClrDebugUtil {
    private _extensionDir: string = '';
    private _debugAdapterDir: string = '';
    private _installCompleteFilePath: string = '';

    constructor(extensionDir: string) {
        this._extensionDir = extensionDir;
        this._debugAdapterDir = path.join(this._extensionDir, '.debugger');
        this._installCompleteFilePath = path.join(this._debugAdapterDir, 'install.complete');
    }

    public extensionDir(): string {
        if (this._extensionDir === '') {
            throw new Error('Failed to set extension directory');
        }
        return this._extensionDir;
    }

    public debugAdapterDir(): string {
        if (this._debugAdapterDir === '') {
            throw new Error('Failed to set debugadpter directory');
        }
        return this._debugAdapterDir;
    }

    public installCompleteFilePath(): string {
        if (this._installCompleteFilePath === '') {
            throw new Error('Failed to set install complete file path');
        }
        return this._installCompleteFilePath;
    }

    public static async writeEmptyFile(path: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.writeFile(path, '', (err) => {
                if (err) {
                    reject(err.code);
                } else {
                    resolve();
                }
            });
        });
    }

    public defaultDotNetCliErrorMessage(): string {
        return 'Failed to find up to date dotnet cli on the path.';
    }

    // This function checks for the presence of dotnet on the path and ensures the Version
    // is new enough for us.
    // Returns: a promise that returns a DotnetInfo class
    // Throws: An DotNetCliError() from the return promise if either dotnet does not exist or is too old.
    public async checkDotNetCli(): Promise<DotnetInfo> {
        let dotnetInfo = await getDotnetInfo();

        if (dotnetInfo.FullInfo === DOTNET_MISSING_MESSAGE) {
            // something went wrong with spawning 'dotnet --info'
            let dotnetError = new DotNetCliError();
            dotnetError.ErrorMessage = 'The .NET Core SDK cannot be located. .NET Core debugging will not be enabled. Make sure the .NET Core SDK is installed and is on the path.';
            dotnetError.ErrorString = "Failed to spawn 'dotnet --info'";
            throw dotnetError;
        }

        // succesfully spawned 'dotnet --info', check the Version
        if (semver.lt(dotnetInfo.Version, MINIMUM_SUPPORTED_DOTNET_CLI)) {
            let dotnetError = new DotNetCliError();
            dotnetError.ErrorMessage = 'The .NET Core SDK located on the path is too old. .NET Core debugging will not be enabled. The minimum supported version is ' + MINIMUM_SUPPORTED_DOTNET_CLI + '.';
            dotnetError.ErrorString = "dotnet cli is too old";
            throw dotnetError;
        }

        return dotnetInfo;
    }

    public static isMacOSSupported(): boolean {
        // .NET Core 2.0 requires macOS 10.12 (Sierra), which is Darwin 16.0+
        // Darwin version chart: https://en.wikipedia.org/wiki/Darwin_(operating_system)
        return semver.gte(os.release(), "16.0.0");
    }

    public static existsSync(path: string): boolean {
        try {
            fs.accessSync(path, fs.constants.F_OK);
            return true;
        } catch (err) {
            if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
                return false;
            } else {
                throw Error(err.code);
            }
        }
    }

    public static getPlatformExeExtension(): string {
        if (process.platform === 'win32') {
            return '.exe';
        }

        return '';
    }
}

const MINIMUM_SUPPORTED_OSX_ARM64_DOTNET_CLI: string = '6.0.0';

export function getTargetArchitecture(platformInfo: PlatformInformation, launchJsonTargetArchitecture: string, dotnetInfo: DotnetInfo): string 
{
    if (!platformInfo)
    {
        throw new Error(`Unable to retrieve 'TargetArchitecture' without platformInfo.`);
    }

    let targetArchitecture = "";

    // On Apple M1 Machines, we need to determine if we need to use the 'x86_64' or 'arm64' debugger.
    if (platformInfo.isMacOS())
    {
        // 'targetArchitecture' is specified in launch.json configuration, use that.
        if (launchJsonTargetArchitecture)
        {
            if (launchJsonTargetArchitecture !== "x86_64" && launchJsonTargetArchitecture !== "arm64")
            {
                throw new Error(`The value '${launchJsonTargetArchitecture}' for 'targetArchitecture' in launch configuraiton is invalid. Expected 'x86_64' or 'arm64'.`);
            }
            targetArchitecture = launchJsonTargetArchitecture;
        }
        else if (dotnetInfo)
        {
            // Find which targetArchitecture to use based on SDK Version or RID.

            // If we are lower than .NET 6, use 'x86_64' since 'arm64' was not supported until .NET 6
            if (dotnetInfo.Version && semver.lt(dotnetInfo.Version, MINIMUM_SUPPORTED_OSX_ARM64_DOTNET_CLI))
            {
                targetArchitecture = 'x86_64';
            }
            else if (dotnetInfo.RuntimeId)
            {
                if (dotnetInfo.RuntimeId.includes('arm64'))
                {
                    targetArchitecture = 'arm64';
                }
                else if (dotnetInfo.RuntimeId.includes('x64'))
                {
                    targetArchitecture = 'x86_64';
                }
                else
                {
                    throw new Error(`Unexpected RuntimeId '${dotnetInfo.RuntimeId}'.`);
                }
            }
        }

        if (!targetArchitecture) {
            // Unable to retrieve any targetArchitecture, go with platformInfo.
            targetArchitecture = platformInfo.architecture;
        }
    }

    return targetArchitecture;
}
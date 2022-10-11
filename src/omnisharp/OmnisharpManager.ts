/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as semver from 'semver';
import * as util from '../common';
import { OmnisharpDownloader } from './OmnisharpDownloader';
import { PlatformInformation } from '../platform';
import { modernNetVersion } from './OmnisharpPackageCreator';

export interface LaunchInfo {
    LaunchPath: string;
    MonoLaunchPath?: string;
}

export class OmnisharpManager {
    private readonly serverUrl = 'https://roslynomnisharp.blob.core.windows.net';

    private readonly latestVersionFileServerPath = 'releases/versioninfo.txt';

    private readonly installPath = '.omnisharp';

    public constructor(
        private downloader: OmnisharpDownloader,
        private platformInfo: PlatformInformation) {
    }

    public async GetOmniSharpLaunchInfo(defaultOmnisharpVersion: string, omnisharpPath: string, useFramework: boolean, extensionPath: string): Promise<LaunchInfo> {
        if (omnisharpPath.length === 0) {
            // If omnisharpPath was not specified, return the default path.
            const basePath = path.resolve(extensionPath, '.omnisharp', defaultOmnisharpVersion + (useFramework ? '' : `-net${modernNetVersion}`));
            return this.GetLaunchInfo(this.platformInfo, useFramework, basePath);
        }

        // Looks at the options path, installs the dependencies and returns the path to be loaded by the omnisharp server
        if (path.isAbsolute(omnisharpPath)) {
            if (!await util.fileExists(omnisharpPath)) {
                throw new Error('The system could not find the specified path');
            }

            return {
                LaunchPath: omnisharpPath
            };
        }
        else if (omnisharpPath === 'latest') {
            return await this.InstallLatestAndReturnLaunchInfo(useFramework, extensionPath);
        }

        // If the path is neither a valid path on disk not the string "latest", treat it as a version
        return await this.InstallVersionAndReturnLaunchInfo(omnisharpPath, useFramework, extensionPath);
    }

    private async InstallLatestAndReturnLaunchInfo(useFramework: boolean, extensionPath: string): Promise<LaunchInfo> {
        const version = await this.downloader.GetLatestVersion(this.serverUrl, this.latestVersionFileServerPath);
        return await this.InstallVersionAndReturnLaunchInfo(version, useFramework, extensionPath);
    }

    private async InstallVersionAndReturnLaunchInfo(version: string, useFramework: boolean, extensionPath: string): Promise<LaunchInfo> {
        if (semver.valid(version)) {
            await this.downloader.DownloadAndInstallOmnisharp(version, useFramework, this.serverUrl, this.installPath);
            return this.GetLaunchPathForVersion(this.platformInfo, useFramework, version, this.installPath, extensionPath);
        }
        else {
            throw new Error(`Invalid OmniSharp version - ${version}`);
        }
    }

    private GetLaunchPathForVersion(platformInfo: PlatformInformation, isFramework: boolean, version: string, installPath: string, extensionPath: string): LaunchInfo {
        if (!version) {
            throw new Error('Invalid Version');
        }

        let basePath = path.resolve(extensionPath, installPath, version + (isFramework ? '' : `-net${modernNetVersion}`));

        return this.GetLaunchInfo(platformInfo, isFramework, basePath);
    }

    private GetLaunchInfo(platformInfo: PlatformInformation, isFramework: boolean, basePath: string): LaunchInfo {
        if (!isFramework) {
            return {
                LaunchPath: path.join(basePath, 'OmniSharp.dll')
            };
        }
        else if (platformInfo.isWindows()) {
            return {
                LaunchPath: path.join(basePath, 'OmniSharp.exe')
            };
        }

        return {
            LaunchPath: path.join(basePath, 'run'),
            MonoLaunchPath: path.join(basePath, 'omnisharp', 'OmniSharp.exe')
        };
    }
}

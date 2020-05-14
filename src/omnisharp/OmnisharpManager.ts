/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as semver from 'semver';
import * as util from '../common';
import { OmnisharpDownloader } from './OmnisharpDownloader';
import { PlatformInformation } from '../platform';

export interface LaunchInfo {
    LaunchPath: string;
    MonoLaunchPath?: string;
}

export class OmnisharpManager {
    public constructor(
        private downloader: OmnisharpDownloader,
        private platformInfo: PlatformInformation) {
    }

    public async GetOmniSharpLaunchInfo(defaultOmnisharpVersion: string, omnisharpPath: string, serverUrl: string, latestVersionFileServerPath: string, installPath: string, extensionPath: string): Promise<LaunchInfo> {
        if (!omnisharpPath) {
            // If omnisharpPath was not specified, return the default path.
            let basePath = path.resolve(extensionPath, '.omnisharp', defaultOmnisharpVersion);
            return this.GetLaunchInfo(this.platformInfo, basePath);
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
            return await this.InstallLatestAndReturnLaunchInfo(serverUrl, latestVersionFileServerPath, installPath, extensionPath);
        }

        // If the path is neither a valid path on disk not the string "latest", treat it as a version
        return await this.InstallVersionAndReturnLaunchInfo(omnisharpPath, serverUrl, installPath, extensionPath);
    }

    private async InstallLatestAndReturnLaunchInfo(serverUrl: string, latestVersionFileServerPath: string, installPath: string, extensionPath: string): Promise<LaunchInfo> {
        let version = await this.downloader.GetLatestVersion(serverUrl, latestVersionFileServerPath);
        return await this.InstallVersionAndReturnLaunchInfo(version, serverUrl, installPath, extensionPath);
    }

    private async InstallVersionAndReturnLaunchInfo(version: string, serverUrl: string, installPath: string, extensionPath: string): Promise<LaunchInfo> {
        if (semver.valid(version)) {
            await this.downloader.DownloadAndInstallOmnisharp(version, serverUrl, installPath);
            return this.GetLaunchPathForVersion(this.platformInfo, version, installPath, extensionPath);
        }
        else {
            throw new Error(`Invalid OmniSharp version - ${version}`);
        }
    }

    private GetLaunchPathForVersion(platformInfo: PlatformInformation, version: string, installPath: string, extensionPath: string): LaunchInfo {
        if (!version) {
            throw new Error('Invalid Version');
        }

        let basePath = path.resolve(extensionPath, installPath, version);

        return this.GetLaunchInfo(platformInfo, basePath);
    }

    private GetLaunchInfo(platformInfo: PlatformInformation, basePath: string): LaunchInfo {
        if (platformInfo.isWindows()) {
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
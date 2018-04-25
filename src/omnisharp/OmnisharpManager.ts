/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as semver from 'semver';
import * as util from '../common';
import { OmnisharpDownloader } from './OmnisharpDownloader';
import { PlatformInformation } from '../platform';

export interface OmniSharpLaunchInfo {
    LaunchPath: string;
}

export class OmnisharpManager {
    public constructor(
        private downloader: OmnisharpDownloader,
        private platformInfo: PlatformInformation) {
    }

    public async GetOmnisharpPath(omnisharpPath: string, useMono: boolean, serverUrl: string, latestVersionFileServerPath: string, installPath: string, extensionPath: string): Promise<OmniSharpLaunchInfo> {
        // Looks at the options path, installs the dependencies and returns the path to be loaded by the omnisharp server
        if (path.isAbsolute(omnisharpPath)) {
            if (await util.fileExists(omnisharpPath)) {
                return { LaunchPath: omnisharpPath };
            }
            else {
                throw new Error('The system could not find the specified path');
            }
        }
        else if (omnisharpPath == "latest") {
            return await this.InstallLatestAndReturnLaunchPath(useMono, serverUrl, latestVersionFileServerPath, installPath, extensionPath);
        }

        //If the path is neither a valid path on disk not the string "latest", treat it as a version 
        return await this.InstallVersionAndReturnLaunchPath(omnisharpPath, useMono, serverUrl, installPath, extensionPath);
    }

    private async InstallLatestAndReturnLaunchPath(useMono: boolean, serverUrl: string, latestVersionFileServerPath: string, installPath: string, extensionPath: string): Promise<OmniSharpLaunchInfo> {
        let version = await this.downloader.GetLatestVersion(serverUrl, latestVersionFileServerPath);
        return await this.InstallVersionAndReturnLaunchPath(version, useMono, serverUrl, installPath, extensionPath);
    }

    private async InstallVersionAndReturnLaunchPath(version: string, useMono: boolean, serverUrl: string, installPath: string, extensionPath: string) {
        if (semver.valid(version)) {
            await this.downloader.DownloadAndInstallOmnisharp(version, serverUrl, installPath);
            return GetLaunchPathForVersion(this.platformInfo, version, installPath, extensionPath, useMono);
        }
        else {
            throw new Error(`Invalid omnisharp version - ${version}`);
        }
    }
}

function GetLaunchPathForVersion(platformInfo: PlatformInformation, version: string, installPath: string, extensionPath: string, useMono: boolean): OmniSharpLaunchInfo {
    if (!version) {
        throw new Error('Invalid Version');
    }

    let basePath = path.resolve(extensionPath, installPath, version);

    if (platformInfo.isWindows()) {
        return { LaunchPath: path.join(basePath, 'OmniSharp.exe') };
    }
    if (useMono) {
        return { LaunchPath: path.join(basePath, 'omnisharp', 'OmniSharp.exe') };
    }

    return { LaunchPath: path.join(basePath, 'run') };
}


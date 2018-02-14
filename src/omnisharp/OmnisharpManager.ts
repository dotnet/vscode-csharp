/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as util from '../common';
import * as path from 'path';
import * as semver from 'semver';
import * as vscode from 'vscode';
import { Logger } from '../logger';
import { OmnisharpDownloader } from './OmnisharpDownloader';
import TelemetryReporter from 'vscode-extension-telemetry';
import { PlatformInformation } from '../platform';

export class OmnisharpManager {
    public constructor(
        private channel: vscode.OutputChannel,
        private logger: Logger,
        private packageJSON: any,
        private reporter?: TelemetryReporter) {
    }

    public async GetOmnisharpPath(omnisharpPath: string, useMono: boolean, serverUrl: string, installPath: string, extensionPath: string, platformInfo: PlatformInformation): Promise<string> {
        // Looks at the options path, installs the dependencies and returns the path to be loaded by the omnisharp server
        // To Do : Add the functionality for the latest option

        if (path.isAbsolute(omnisharpPath)) {
            if (await util.fileExists(omnisharpPath)) {
                return omnisharpPath;
            }
            else {
                throw new Error('Invalid path specified');
            }
        }
        //If the path is not a valid path on disk, treat it as a version 
        return await this.InstallVersionAndReturnLaunchPath(omnisharpPath, useMono, serverUrl, installPath, extensionPath, platformInfo);
    }

    public async InstallVersionAndReturnLaunchPath(version: string, useMono: boolean, serverUrl: string, installPath: string, extensionPath: string, platformInfo: PlatformInformation) {
        if (semver.valid(version) || version == "latest") {
            let downloader = new OmnisharpDownloader(this.channel, this.logger, this.packageJSON, this.reporter);
            await downloader.DownloadAndInstallOmnisharp(version, serverUrl, installPath, platformInfo);

            return await GetLaunchPathForVersion(platformInfo, version, installPath, extensionPath, useMono);
        }
        else {
            throw new Error('Invalid omnisharp version specified');
        }
    }
}

export async function GetLaunchPathForVersion(platformInfo: PlatformInformation, version: string, installPath: string, extensionPath: string, useMono: boolean) {
    if (!version) {
        throw new Error('Invalid Version');
    }

    let basePath = path.resolve(extensionPath, installPath, version);

    if (platformInfo.isWindows()) {
        return path.join(basePath, 'OmniSharp.exe');
    }
    if (useMono) {
        return path.join(basePath, 'omnisharp', 'OmniSharp.exe');
    }

    return path.join(basePath, 'run');
}


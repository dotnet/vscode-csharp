/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as util from '../common';
import * as path from 'path';
import * as semver from 'semver';
import * as vscode from 'vscode';
import { Logger } from '../logger';
import { OmnisharpDownloader } from './experimentalOmnisharpDownloader';
import TelemetryReporter from 'vscode-extension-telemetry';
import { PlatformInformation } from '../platform';

export class ExperimentalOmnisharpManager {
    public constructor(
        private channel: vscode.OutputChannel,
        private logger: Logger,
        private reporter: TelemetryReporter,
        private packageJSON: any
    ) {
    }

    public async GetExperimentalOmnisharpPath(optionPath: string, useMono: boolean): Promise<string> {
        // Looks at the options path, installs the dependencies and returns the path to be loaded by the omnisharp server
        // To Do : Add the functionality for the latest option

        if (await util.fileExists(optionPath)) {
            return optionPath;
        }

        let serverUrl = "https://omnisharpdownload.blob.core.windows.net";
        let installPath = ".omnisharp/experimental";
        let platformInfo = await PlatformInformation.GetCurrent();
        let extensionPath = util.getExtensionPath();
        return await this.InstallVersionAndReturnLaunchPath(optionPath, useMono, serverUrl, installPath, extensionPath, platformInfo);
    }

    private async InstallVersionAndReturnLaunchPath(version: string, useMono: boolean, serverUrl: string, installPath: string, extensionPath: string, platformInfo: PlatformInformation) {
        if (IsValidSemver(version)) {
            let downloader = new OmnisharpDownloader(this.channel, this.logger, this.reporter, this.packageJSON);
            await downloader.DownloadAndInstallExperimentalVersion(version, serverUrl, installPath);

            return await GetLaunchPathForVersion(platformInfo, version, installPath, extensionPath, useMono);
        }
        else {
            throw new Error('Bad Input to Omnisharp Path');
        }
    }
}

function IsValidSemver(version: string): boolean {
    if (semver.valid(version)) {
        return true;
    }

    return false;
}

async function GetLaunchPathForVersion(platformInfo: PlatformInformation, version: string, installPath: string, extensionPath: string, useMono: boolean) {
    let basePath = path.resolve(extensionPath, installPath, version);

    if (platformInfo.isWindows()) {
        return path.resolve(basePath, 'Omnisharp.exe');
    }
    if (useMono) {
        return path.resolve(basePath, 'omnisharp', 'OmniSharp.exe');
    }
    return path.resolve(basePath, 'run');
}


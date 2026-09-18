/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as semver from 'semver';
import * as util from '../common';
import { OmnisharpDownloader } from './omnisharpDownloader';
import { getPackageSuffix } from './omnisharpPackageCreator';

export class OmnisharpManager {
    private readonly installPath = '.omnisharp';

    public constructor(
        private downloader: OmnisharpDownloader,
        // Only the tests set this. Instead of making this configurable,
        // we should probably just mock the HTTP requests, not create an entire mock HTTP server.
        private serverUrl: string = 'https://github.com/OmniSharp/omnisharp-roslyn'
    ) {}

    public async GetOmniSharpLaunchPath(
        defaultOmnisharpVersion: string,
        omnisharpPath: string,
        extensionPath: string
    ): Promise<string> {
        if (omnisharpPath.length === 0) {
            return this.GetLaunchPathForVersion(defaultOmnisharpVersion, extensionPath);
        }

        // Looks at the options path, installs the dependencies and returns the path to be loaded by the omnisharp server
        if (path.isAbsolute(omnisharpPath)) {
            if (!(await util.fileExists(omnisharpPath))) {
                throw new Error('The system could not find the specified path');
            }

            return omnisharpPath;
        }

        // If the path is not a valid path on disk, treat it as a pinned version.
        return await this.InstallVersionAndReturnLaunchInfo(omnisharpPath, extensionPath);
    }

    private async InstallVersionAndReturnLaunchInfo(version: string, extensionPath: string): Promise<string> {
        if (semver.valid(version)) {
            await this.downloader.DownloadAndInstallOmnisharp(version, this.serverUrl, this.installPath);
            return this.GetLaunchPathForVersion(version, extensionPath);
        } else {
            throw new Error(`Invalid OmniSharp version - ${version}`);
        }
    }

    private GetLaunchPathForVersion(version: string, extensionPath: string): string {
        const basePath = path.resolve(extensionPath, this.installPath, version + getPackageSuffix(version));
        return path.join(basePath, 'OmniSharp.dll');
    }
}

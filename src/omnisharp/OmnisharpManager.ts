/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as semver from 'semver';
import * as util from '../common';
import { Package } from '../packageManager/Package';
import { ResolveFilePaths } from '../packageManager/PackageFilePathResolver';
import { OmniSharpLaunchInfo } from './OmniSharpLaunchInfo';

export interface IGetLatestVersion {
    (): Promise<string>;
}

export interface IGetVersionPackages {
    (version: string): Package[];
}

export interface IInstallRuntimeDependencies {
    (packages: Package[]): Promise<boolean>;
}

export interface IGetOmniSharpLaunchInfo {
    (path: string): OmniSharpLaunchInfo;
}

export class OmnisharpManager {
    public constructor(
        private installRuntimeDependencies: IInstallRuntimeDependencies,
        private getLatestVersion: IGetLatestVersion,
        private getPackagesForVersion: IGetVersionPackages,
        private getOmniSharpLaunchInfo: IGetOmniSharpLaunchInfo) {
    }

    public async GetOmniSharpLaunchInfo(defaultOmnisharpVersion: string, omnisharpPath: string, installPath: string, extensionPath: string): Promise<OmniSharpLaunchInfo> {
        if (!omnisharpPath) {
            // If omnisharpPath was not specified, return the default path.
            let basePath = path.resolve(extensionPath, '.omnisharp', defaultOmnisharpVersion);
            return this.getOmniSharpLaunchInfo(basePath);
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
            return await this.InstallLatestAndReturnLaunchInfo(installPath, extensionPath);
        }

        // If the path is neither a valid path on disk not the string "latest", treat it as a version 
        return await this.InstallVersionAndReturnLaunchInfo(omnisharpPath, installPath, extensionPath);
    }

    private async InstallLatestAndReturnLaunchInfo(installPath: string, extensionPath: string): Promise<OmniSharpLaunchInfo> {
        let version = await this.getLatestVersion();
        return await this.InstallVersionAndReturnLaunchInfo(version, installPath, extensionPath);
    }

    private async InstallVersionAndReturnLaunchInfo(version: string, installPath: string, extensionPath: string): Promise<OmniSharpLaunchInfo> {
        if (semver.valid(version)) {
            let packages = this.getPackagesForVersion(version);
            packages.forEach(pkg => ResolveFilePaths(pkg));
            await this.installRuntimeDependencies(packages);
            return this.GetLaunchPathForVersion(version, installPath, extensionPath);
        }
        else {
            throw new Error(`Invalid OmniSharp version - ${version}`);
        }
    }

    private GetLaunchPathForVersion(version: string, installPath: string, extensionPath: string): OmniSharpLaunchInfo {
        if (!version) {
            throw new Error('Invalid Version');
        }

        let basePath = path.resolve(extensionPath, installPath, version);
        return this.getOmniSharpLaunchInfo(basePath);
    }
}
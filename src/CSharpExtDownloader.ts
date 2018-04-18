/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as util from './common';
import { PlatformInformation } from './platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure } from './omnisharp/loggingEvents';
import { EventStream } from './EventStream';
import { DownloadAndInstallPackages } from './packageManager/PackageManager';
import { Package } from './packageManager/packages';
import { NetworkSettingsProvider } from './NetworkSettings';
import { ResolveFilePaths } from './packageManager/PackageFilePathResolver';

/*
 * Class used to download the runtime dependencies of the C# Extension
 */
export class CSharpExtDownloader {

    public constructor(
        private provider: NetworkSettingsProvider,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation) {
    }

    public async installRuntimeDependencies(): Promise<boolean> {
        this.eventStream.post(new PackageInstallation("C# dependencies"));
        let success = false;
        let installationStage = '';

        try {

            await util.touchInstallFile(util.InstallFileType.Begin);
            // Display platform information and RID
            this.eventStream.post(new LogPlatformInfo(this.platformInfo));
            let runTimeDependencies = this.GetRunTimeDependenciesPackages();
            runTimeDependencies.forEach(pkg => ResolveFilePaths(pkg));
            installationStage = 'downloadAndInstallPackages';
            await DownloadAndInstallPackages(runTimeDependencies, this.provider, this.platformInfo, this.eventStream);
            installationStage = 'touchLockFile';
            await util.touchInstallFile(util.InstallFileType.Lock);
            success = true;
            this.eventStream.post(new InstallationSuccess());
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure(installationStage, error));
        }
        finally {
            try {
                util.deleteInstallFile(util.InstallFileType.Begin);
            }
            catch (error) { }
            return success;
        }
    }

    private GetRunTimeDependenciesPackages(): Package[] {
        if (this.packageJSON.runtimeDependencies) {
            return JSON.parse(JSON.stringify(<Package[]>this.packageJSON.runtimeDependencies));
        }

        return null;
    }
}
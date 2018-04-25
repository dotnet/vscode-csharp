/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as util from './common';
import { PlatformInformation } from './platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure } from './omnisharp/loggingEvents';
import { EventStream } from './EventStream';
import { DownloadAndInstallPackages } from './packageManager/PackageManager';
import { PackageJSONPackage } from './packageManager/Package';
import { NetworkSettingsProvider } from './NetworkSettings';
import { Package } from './packageManager/RunTimePackages';

/*
 * Class used to download the runtime dependencies of the C# Extension
 */
export class CSharpExtDownloader {

    public constructor(
        private networkSettingsProvider: NetworkSettingsProvider,
        private eventStream: EventStream,
        private platformInfo: PlatformInformation,
        private packageJSON: any,
        private extensionPath: string) {
    }

    public async installRuntimeDependencies(): Promise<boolean> {
        this.eventStream.post(new PackageInstallation("C# dependencies"));
        let installationStage = 'touchBeginFile';

        try {
            await util.touchInstallFile(util.InstallFileType.Begin);
            // Display platform information and RID
            this.eventStream.post(new LogPlatformInfo(this.platformInfo));
            let runTimeDependencies = GetRunTimeDependenciesPackages(this.packageJSON, this.extensionPath);
            installationStage = 'downloadAndInstallPackages';
            await DownloadAndInstallPackages(runTimeDependencies, this.networkSettingsProvider, this.platformInfo, this.eventStream);
            installationStage = 'touchLockFile';
            await util.touchInstallFile(util.InstallFileType.Lock);
            this.eventStream.post(new InstallationSuccess());
            return true;
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure(installationStage, error));
            return false;
        }
        finally {
            try {
                util.deleteInstallFile(util.InstallFileType.Begin);
            }
            catch (error) { }
        }
    }
}

export function GetRunTimeDependenciesPackages(packageJSON: any, extensionPath: string): PackageJSONPackage[] {
    if (packageJSON.runtimeDependencies) {
        let dependencies = <PackageJSONPackage[]>packageJSON.runtimeDependencies;
        return dependencies.map(pkg => new Package(pkg, extensionPath));
    }

    throw new Error("No runtime dependencies found");
}
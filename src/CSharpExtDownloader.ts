/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from './platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess } from './omnisharp/loggingEvents';
import { EventStream } from './EventStream';
import { DownloadAndInstallPackages } from './packageManager/PackageManager';
import { Package } from './packageManager/Package';
import { NetworkSettingsProvider } from './NetworkSettings';

/*
 * Class used to download the runtime dependencies of the C# Extension
 */
export class CSharpExtDownloader {

    public constructor(
        private networkSettingsProvider: NetworkSettingsProvider,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation,
        private extensionPath: string) {
    }

    public async installRuntimeDependencies(): Promise<boolean> {
        this.eventStream.post(new PackageInstallation("C# dependencies"));

        try {
            // Display platform information and RID
            this.eventStream.post(new LogPlatformInfo(this.platformInfo));
            let runTimeDependencies = GetRunTimeDependenciesPackages(this.packageJSON);
            await DownloadAndInstallPackages(runTimeDependencies, this.networkSettingsProvider, this.platformInfo, this.eventStream, this.extensionPath);
            this.eventStream.post(new InstallationSuccess());
            return true;
        }
        catch (error) {
            return false;
        }
    }
}

export function GetRunTimeDependenciesPackages(packageJSON: any): Package[] {
    if (packageJSON.runtimeDependencies) {
        return JSON.parse(JSON.stringify(<Package[]>packageJSON.runtimeDependencies));
    }

    throw new Error("No runtime dependencies found");
}
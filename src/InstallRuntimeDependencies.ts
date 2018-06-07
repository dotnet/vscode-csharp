/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as util from './common';
import { PlatformInformation } from './platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure } from './omnisharp/loggingEvents';
import { EventStream } from './EventStream';
import { DownloadAndInstallPackages } from './packageManager/PackageManager';
import { Package } from './packageManager/Package';
import { NetworkSettingsProvider } from './NetworkSettings';

/*
 * Function used to download and install the runtime dependencies of the C# Extension
 */

export async function installRuntimeDependencies(eventStream: EventStream, platformInfo: PlatformInformation, networkSettingsProvider: NetworkSettingsProvider, runtimeDependencies: Package[]): Promise<boolean> {
    eventStream.post(new PackageInstallation("C# dependencies"));
    let installationStage = 'touchBeginFile';

    try {
        await util.touchInstallFile(util.InstallFileType.Begin);
        // Display platform information and RID
        eventStream.post(new LogPlatformInfo(platformInfo));
        installationStage = 'downloadAndInstallPackages';
        await DownloadAndInstallPackages(runtimeDependencies, networkSettingsProvider, platformInfo, eventStream);
        installationStage = 'touchLockFile';
        await util.touchInstallFile(util.InstallFileType.Lock);
        eventStream.post(new InstallationSuccess());
        return true;
    }
    catch (error) {
        eventStream.post(new InstallationFailure(installationStage, error));
        return false;
    }
    finally {
        try {
            util.deleteInstallFile(util.InstallFileType.Begin);
        }
        catch (error) { }
    }
}

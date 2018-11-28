/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from './platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess } from './omnisharp/loggingEvents';
import { EventStream } from './EventStream';
import { downloadAndInstallPackages1 } from './packageManager/PackageManager';
import { NetworkSettingsProvider } from './NetworkSettings';
import { getRuntimeDependenciesPackages } from './tools/RuntimeDependencyPackageUtils';
import { AbsolutePathPackage } from './packageManager/AbsolutePathPackage';
import { filterPackages } from './packageManager/PackageFilterer';

export async function installRuntimeDependencies(packageJSON: any, extensionPath: string, networkSettingsProvider: NetworkSettingsProvider, eventStream: EventStream, platformInfo: PlatformInformation): Promise<boolean>{
    let runTimeDependencies = getRuntimeDependenciesPackages(packageJSON);
    let absolutePathPackages = runTimeDependencies.map(pkg => AbsolutePathPackage.getAbsolutePathPackage(pkg, extensionPath));
    let packagesToInstall = await filterPackages(absolutePathPackages, platformInfo);
    if (packagesToInstall && packagesToInstall.length > 0) {
        eventStream.post(new PackageInstallation("C# dependencies"));
        try {
            // Display platform information and RID
            eventStream.post(new LogPlatformInfo(platformInfo));
            await downloadAndInstallPackages1(packagesToInstall, networkSettingsProvider, eventStream);
            eventStream.post(new InstallationSuccess());
            return true;
        }
        catch (error) {
            return false;
        }
    }

    //All the required packages are already downloaded and installed
    return true;
}


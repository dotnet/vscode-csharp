/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from './platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess } from './omnisharp/loggingEvents';
import { EventStream } from './EventStream';
import { getRuntimeDependenciesPackages } from './tools/RuntimeDependencyPackageUtils';
import { getAbsolutePathPackagesToInstall } from './packageManager/getAbsolutePathPackagesToInstall';
import IInstallDependencies from './packageManager/IInstallDependencies';

export async function installRuntimeDependencies(packageJSON: any, extensionPath: string, installDependencies: IInstallDependencies, eventStream: EventStream, platformInfo: PlatformInformation): Promise<boolean> {
    let runTimeDependencies = getRuntimeDependenciesPackages(packageJSON);
    let packagesToInstall = await getAbsolutePathPackagesToInstall(runTimeDependencies, platformInfo, extensionPath);
    if (packagesToInstall && packagesToInstall.length > 0) {
        eventStream.post(new PackageInstallation("C# dependencies"));
        // Display platform information and RID
        eventStream.post(new LogPlatformInfo(platformInfo));
        if (await installDependencies(packagesToInstall)) {
            eventStream.post(new InstallationSuccess());
        }
        else {
            return false;
        }
    }

    //All the required packages are already downloaded and installed
    return true;
}


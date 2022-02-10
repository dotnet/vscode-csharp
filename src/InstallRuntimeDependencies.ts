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
import { AbsolutePathPackage } from './packageManager/AbsolutePathPackage';

export async function installRuntimeDependencies(packageJSON: any, extensionPath: string, installDependencies: IInstallDependencies, eventStream: EventStream, platformInfo: PlatformInformation, useFramework: boolean): Promise<boolean> {
    const runTimeDependencies = getRuntimeDependenciesPackages(packageJSON);
    const packagesToInstall = await getAbsolutePathPackagesToInstall(runTimeDependencies, platformInfo, extensionPath);
    const filteredPackages = filterOmniSharpPackage(packagesToInstall, useFramework);

    if (filteredPackages && filteredPackages.length > 0) {
        eventStream.post(new PackageInstallation("C# dependencies"));
        // Display platform information and RID
        eventStream.post(new LogPlatformInfo(platformInfo));

        if (await installDependencies(filteredPackages)) {
            eventStream.post(new InstallationSuccess());
        }
        else {
            return false;
        }
    }

    //All the required packages are already downloaded and installed
    return true;
}

function filterOmniSharpPackage(packages: AbsolutePathPackage[], useFramework: boolean) {
    // Since we will have more than one OmniSharp package defined for some platforms, we need
    // to filter out the one that doesn't match which dotnet runtime is being used.
    return packages.filter(pkg => pkg.id != "OmniSharp" || pkg.isFramework === useFramework);
}

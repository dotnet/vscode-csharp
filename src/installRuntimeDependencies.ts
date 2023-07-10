/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from './shared/platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess } from './omnisharp/loggingEvents';
import { EventStream } from './eventStream';
import { getRuntimeDependenciesPackages } from './tools/runtimeDependencyPackageUtils';
import { getAbsolutePathPackagesToInstall } from './packageManager/getAbsolutePathPackagesToInstall';
import IInstallDependencies from './packageManager/IInstallDependencies';
import { AbsolutePathPackage } from './packageManager/absolutePathPackage';

export async function installRuntimeDependencies(
    packageJSON: any,
    extensionPath: string,
    installDependencies: IInstallDependencies,
    eventStream: EventStream,
    platformInfo: PlatformInformation,
    useFramework: boolean,
    requiredPackageIds: string[]
): Promise<boolean> {
    const runTimeDependencies = getRuntimeDependenciesPackages(packageJSON);
    const packagesToInstall = await getAbsolutePathPackagesToInstall(runTimeDependencies, platformInfo, extensionPath);
    const filteredPackages = filterOmniSharpPackage(packagesToInstall, useFramework);
    const filteredRequiredPackages = filteredRequiredPackage(requiredPackageIds, filteredPackages);

    if (filteredRequiredPackages.length > 0) {
        eventStream.post(new PackageInstallation('C# dependencies'));
        // Display platform information and RID
        eventStream.post(new LogPlatformInfo(platformInfo));

        if (await installDependencies(filteredRequiredPackages)) {
            eventStream.post(new InstallationSuccess());
        } else {
            return false;
        }
    }

    //All the required packages are already downloaded and installed
    return true;
}

function filterOmniSharpPackage(packages: AbsolutePathPackage[], useFramework: boolean) {
    // Since we will have more than one OmniSharp package defined for some platforms, we need
    // to filter out the one that doesn't match which dotnet runtime is being used.
    return packages.filter((pkg) => pkg.id !== 'OmniSharp' || pkg.isFramework === useFramework);
}

function filteredRequiredPackage(requiredPackageIds: string[], packages: AbsolutePathPackage[]) {
    return packages.filter((pkg) => requiredPackageIds.includes(pkg.id));
}

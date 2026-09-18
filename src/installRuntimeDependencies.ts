/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from './shared/platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess } from './shared/loggingEvents';
import { EventStream } from './eventStream';
import { getRuntimeDependenciesPackages } from './tools/runtimeDependencyPackageUtils';
import { getAbsolutePathPackagesToInstall } from './packageManager/getAbsolutePathPackagesToInstall';
import { DependencyInstallationStatus, IInstallDependencies } from './packageManager/IInstallDependencies';
import { AbsolutePathPackage } from './packageManager/absolutePathPackage';

export async function installRuntimeDependencies(
    packageJSON: any,
    extensionPath: string,
    installDependencies: IInstallDependencies,
    eventStream: EventStream,
    platformInfo: PlatformInformation,
    requiredPackageIds: string[]
): Promise<DependencyInstallationStatus> {
    const runTimeDependencies = getRuntimeDependenciesPackages(packageJSON);
    const packagesToInstall = await getAbsolutePathPackagesToInstall(runTimeDependencies, platformInfo, extensionPath);

    // PackagesToInstall will only return packages that are not already installed. However,
    // we need to return the installation status of all required packages, so we need to
    // track which required packages are already installed, so that we can return true for them.
    const installedPackages = requiredPackageIds.filter(
        (id) => packagesToInstall.find((pkg) => pkg.id === id) === undefined
    );
    const installedPackagesResults = installedPackages.reduce((acc, id) => ({ ...acc, [id]: true }), {});

    const filteredRequiredPackages = filteredRequiredPackage(requiredPackageIds, packagesToInstall);

    if (filteredRequiredPackages.length === 0) {
        return installedPackagesResults;
    }

    eventStream.post(new PackageInstallation('C# dependencies'));
    // Display platform information and RID
    eventStream.post(new LogPlatformInfo(platformInfo));

    const installationResults = await installDependencies(filteredRequiredPackages);

    const failedPackages = Object.entries(installationResults)
        .filter(([, installed]) => !installed)
        .map(([name]) => name);
    if (failedPackages.length === 0) {
        eventStream.post(new InstallationSuccess());
    }

    return { ...installedPackagesResults, ...installationResults };
}

function filteredRequiredPackage(requiredPackageIds: string[], packages: AbsolutePathPackage[]) {
    return packages.filter((pkg) => requiredPackageIds.includes(pkg.id));
}

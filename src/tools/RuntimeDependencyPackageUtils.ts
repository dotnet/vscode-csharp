/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from '../platform';
import { AbsolutePathPackage } from '../packageManager/AbsolutePathPackage';
import { filterPlatformPackages } from '../packageManager/PackageFilterer';
import { Package } from '../packageManager/Package';

export function getRuntimeDependencyPackageWithId(packageId: string, packageJSON: any, platformInfo: PlatformInformation, extensionPath: string): AbsolutePathPackage {
    let runtimeDependencies = getRuntimeDependenciesPackages(packageJSON);
    let absolutePathPackages = runtimeDependencies.map(pkg => AbsolutePathPackage.getAbsolutePathPackage(pkg, extensionPath));
    let platformSpecificPackage = filterPlatformPackages(absolutePathPackages, platformInfo);
    return platformSpecificPackage.find(pkg => pkg.id == packageId);
}

export function getRuntimeDependenciesPackages(packageJSON: any): Package[] {
    if (packageJSON.runtimeDependencies) {
        return JSON.parse(JSON.stringify(<Package[]>packageJSON.runtimeDependencies));
    }
    throw new Error("No runtime dependencies found");
}
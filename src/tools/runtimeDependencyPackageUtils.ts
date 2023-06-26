/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from '../shared/platform';
import { AbsolutePathPackage } from '../packageManager/absolutePathPackage';
import { filterPlatformPackages } from '../packageManager/packageFilterer';
import { Package } from '../packageManager/package';

export function getRuntimeDependencyPackageWithId(packageId: string, packageJSON: any, platformInfo: PlatformInformation, extensionPath: string): AbsolutePathPackage | undefined {
    const runtimeDependencies = getRuntimeDependenciesPackages(packageJSON);
    const absolutePathPackages = runtimeDependencies.map(pkg => AbsolutePathPackage.getAbsolutePathPackage(pkg, extensionPath));
    const platformSpecificPackage = filterPlatformPackages(absolutePathPackages, platformInfo);
    return platformSpecificPackage.find(pkg => pkg.id === packageId);
}

export function getRuntimeDependenciesPackages(packageJSON: any): Package[] {
    if (packageJSON.runtimeDependencies) {
        return JSON.parse(JSON.stringify(<Package[]>packageJSON.runtimeDependencies));
    }
    throw new Error("No runtime dependencies found");
}

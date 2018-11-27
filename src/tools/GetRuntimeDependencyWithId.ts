/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from '../platform';
import { AbsolutePathPackage } from '../packageManager/AbsolutePathPackage';
import { GetRunTimeDependenciesPackages } from '../CSharpExtDownloader';
import { filterPlatformPackages } from '../packageManager/PackageFilterer';

export function getRuntimeDependencyPackageWithId(packageId: string, packageJSON: any, platformInfo: PlatformInformation, extensionPath: string): AbsolutePathPackage {
    let runtimeDependencies = GetRunTimeDependenciesPackages(packageJSON);
    let absolutePathPackages = runtimeDependencies.map(pkg => AbsolutePathPackage.getAbsolutePathPackage(pkg, extensionPath));
    let platformSpecificPackage = filterPlatformPackages(absolutePathPackages, platformInfo);
    return platformSpecificPackage.find(pkg => pkg.Id == packageId);
}
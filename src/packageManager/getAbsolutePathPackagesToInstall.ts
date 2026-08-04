/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from '../shared/platform.ts';
import { AbsolutePathPackage } from './absolutePathPackage.ts';
import { getNotInstalledPackagesForPlatform } from './packageFilterer.ts';
import { Package } from './package.ts';

export async function getAbsolutePathPackagesToInstall(
    packages: Package[],
    platformInfo: PlatformInformation,
    extensionPath: string
): Promise<AbsolutePathPackage[]> {
    const absolutePathPackages = packages.map((pkg) => AbsolutePathPackage.getAbsolutePathPackage(pkg, extensionPath));
    return getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);
}

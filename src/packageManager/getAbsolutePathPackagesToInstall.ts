/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../platform";
import { AbsolutePathPackage } from "./AbsolutePathPackage";
import { getNotInstalledPackagesForPlatform } from "./PackageFilterer";
import { Package } from "./Package";

export async function getAbsolutePathPackagesToInstall(packages: Package[], platformInfo: PlatformInformation, extensionPath: string): Promise<AbsolutePathPackage[]> {
    if (packages && packages.length > 0) {
        let absolutePathPackages = packages.map(pkg => AbsolutePathPackage.getAbsolutePathPackage(pkg, extensionPath));
        return getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);
    }

    return [];
}
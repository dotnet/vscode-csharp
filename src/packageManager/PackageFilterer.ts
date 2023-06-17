/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../shared/platform";
import * as util from '../common';
import { AbsolutePathPackage } from "./AbsolutePathPackage";

export async function getNotInstalledPackagesForPlatform(packages: AbsolutePathPackage[], platformInfo: PlatformInformation): Promise<AbsolutePathPackage[]> {
    const platformPackages = filterPlatformPackages(packages, platformInfo);
    return filterAlreadyInstalledPackages(platformPackages);
}

export function filterPlatformPackages(packages: AbsolutePathPackage[], platformInfo: PlatformInformation) {
    return packages.filter(pkg =>
        pkg.architectures.includes(platformInfo.architecture) && pkg.platforms.includes(platformInfo.platform)
    );
}

async function filterAlreadyInstalledPackages(packages: AbsolutePathPackage[]): Promise<AbsolutePathPackage[]> {
    return util.filterAsync(packages, async pkg => {
        // If the install.Lock file is present for this package then do not install it again
        const testPath = util.getInstallFilePath(pkg.installPath, util.InstallFileType.Lock);
        return !(await util.fileExists(testPath));
    });
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Package } from "./Package";
import { PlatformInformation } from "../platform";
import * as util from '../common';
import { ResolvePackageTestPath } from "./PackageFilePathResolver";
import { PackageError } from "./PackageError";

const { filterAsync } = require('node-filter-async');

export async function filterPackages(packages: Package[], platformInfo: PlatformInformation) {
    let platformPackages = filterPlatformPackages(packages, platformInfo);
    return filterAlreadyInstalledPackages(platformPackages);
}

function filterPlatformPackages(packages: Package[], platformInfo: PlatformInformation) {
    if (packages) {
        return packages.filter(pkg => {
            if (pkg.architectures && pkg.architectures.indexOf(platformInfo.architecture) === -1) {
                return false;
            }

            if (pkg.platforms && pkg.platforms.indexOf(platformInfo.platform) === -1) {
                return false;
            }

            return true;
        });
    }
    else {
        throw new PackageError("Package manifest does not exist.");
    }
}

async function filterAlreadyInstalledPackages(packages: Package[]): Promise<Package[]> {
    return filterAsync(packages, async (pkg: Package) => {
        //If the file is present at the install test path then filter it
        let testPath = ResolvePackageTestPath(pkg);
        if (!testPath) {
            //if there is no testPath specified then we will not filter it
            return true;
        }

        return !(await util.fileExists(testPath));
      });
}
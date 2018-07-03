/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../platform";
import * as util from '../common';
import { PackageError } from "./PackageError";
import { AbsolutePathPackage } from "./AbsolutePathPackage";

const { filterAsync } = require('node-filter-async');

export async function filterPackages(packages: AbsolutePathPackage[], platformInfo: PlatformInformation): Promise<AbsolutePathPackage[]> {
    let platformPackages = filterPlatformPackages(packages, platformInfo);
    return filterAlreadyInstalledPackages(platformPackages);
}

function filterPlatformPackages(packages: AbsolutePathPackage[], platformInfo: PlatformInformation) {
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

async function filterAlreadyInstalledPackages(packages: AbsolutePathPackage[]): Promise<AbsolutePathPackage[]> {
    return filterAsync(packages, async (pkg: AbsolutePathPackage) => {
        //If the file is present at the install test path then filter it
        let testPath = pkg.installTestPath;
        if (!testPath) {
            //if there is no testPath specified then we will not filter it
            return true;
        }

        return !(await util.fileExists(testPath.value));
      });
}
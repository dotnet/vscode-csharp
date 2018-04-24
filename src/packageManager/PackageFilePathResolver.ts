/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as util from '../common';
import { Package } from './Package';

export function ResolveFilePaths(pkg: Package) {
    pkg.installTestPath = ResolvePackageTestPath(pkg);
    pkg.installPath = ResolveBaseInstallPath(pkg);
    pkg.binaries = ResolvePackageBinaries(pkg);
}

export function ResolvePackageTestPath(pkg: Package): string {
    if (pkg.installTestPath) {
        return path.resolve(util.getExtensionPath(), pkg.installTestPath);
    }

    return null;
}

function ResolvePackageBinaries(pkg: Package) {
    if (pkg.binaries) {
        return pkg.binaries.map(value => path.resolve(ResolveBaseInstallPath(pkg), value));
    }

    return null;
}

function ResolveBaseInstallPath(pkg: Package): string {
    let basePath = util.getExtensionPath();
    if (pkg.installPath) {
        basePath = path.resolve(basePath, pkg.installPath);
    }

    return basePath;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as util from '../common';
import { Package } from './packages';

export function ResolveFilePaths(pkg: Package) {
    pkg.installTestPath = ResolvePackageTestPath(pkg);
    pkg.installPath = ResolveBaseInstallPath(pkg);
    pkg.binaries = ResolvePackageBinaries(pkg);
}

function ResolvePackageTestPath(pkg: Package): string {
    if (path.isAbsolute(pkg.installTestPath)) {
        return pkg.installTestPath;
    }
    
    if (pkg.installTestPath) {
        return path.join(util.getExtensionPath(), pkg.installTestPath);
    }
    else {
        return null;
    }
}

function ResolvePackageBinaries(pkg: Package) {
    if (pkg.binaries) {
        return pkg.binaries.map(value => path.resolve(ResolveBaseInstallPath(pkg), value)); 
    }

    return null;
}

function ResolveBaseInstallPath(pkg: Package): string {
    if (path.isAbsolute(pkg.installPath)) {
        return pkg.installPath;
    }

    let basePath = util.getExtensionPath();
    if (pkg.installPath) {
        basePath = path.join(basePath, pkg.installPath);
    }

    return basePath;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as util from '../common';
import { PackageWithRelativePaths, InstallablePackage } from './Package';

export function getInstallablePackages(packages: PackageWithRelativePaths[]): InstallablePackage[]{
    return packages.map(pkg => getInstallablePackage(pkg));
}

function getInstallablePackage(pkg: PackageWithRelativePaths): InstallablePackage {
    return <InstallablePackage>{
        description: pkg.description,
        url: pkg.url,
        fallbackUrl: pkg.fallbackUrl,
        platforms: pkg.platforms,
        architectures: pkg.architectures,
        platformId: pkg.platformId,
        absoluteInstallPath: getAbsoluteInstallPath(pkg),
        absoluteInstallTestPath: getAbsoluteInstallTestPath(pkg),
        absoluteBinaryPaths: getBinariesWithAbsolutePaths(pkg)
    };
}

function getAbsoluteInstallTestPath(pkg: PackageWithRelativePaths): string {
    if (pkg.installTestPath) {
        return path.resolve(util.getExtensionPath(), pkg.installTestPath);
    }

    return null;
}

function getBinariesWithAbsolutePaths(pkg: PackageWithRelativePaths) {
    let absoluteInstallPath = getAbsoluteInstallPath(pkg);
    if (pkg.binaries) {
        return pkg.binaries.map(value => path.resolve(absoluteInstallPath, value));
    }

    return null;
}

function getAbsoluteInstallPath(pkg: PackageWithRelativePaths): string {
    let basePath = util.getExtensionPath();
    if (pkg.installPath) {
        basePath = path.resolve(basePath, pkg.installPath);
    }

    return basePath;
}

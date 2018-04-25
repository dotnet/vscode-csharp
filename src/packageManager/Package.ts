/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { PackageJSONPackage } from "./PackageJSONPackage";

export class Package{
    description: string;
    url: string;
    fallbackUrl?: string;
    installPath?: string;
    platforms: string[];
    architectures: string[];
    binaries: string[];
    installTestPath?: string;

    constructor(pkg: PackageJSONPackage, extensionPath: string) {
        this.description = pkg.description;
        this.url = pkg.url;
        this.fallbackUrl = pkg.fallbackUrl;
        this.installPath = ResolveBaseInstallPath(pkg, extensionPath);
        this.platforms = pkg.platforms;
        this.architectures = pkg.architectures;
        this.binaries = ResolvePackageBinaries(pkg, extensionPath);
        this.installTestPath = ResolvePackageTestPath(pkg, extensionPath);
    }
}

export function ResolvePackageTestPath(pkg: PackageJSONPackage, extensionPath: string): string {
    if (pkg.installTestPath) {
        return path.resolve(extensionPath, pkg.installTestPath);
    }

    return null;
}

function ResolvePackageBinaries(pkg: PackageJSONPackage, extensionPath: string) {
    if (pkg.binaries) {
        return pkg.binaries.map(value => path.resolve(ResolveBaseInstallPath(pkg, extensionPath), value));
    }

    return null;
}

function ResolveBaseInstallPath(pkg: PackageJSONPackage, extensionPath: string): string {
    if (pkg.installPath) {
        return path.resolve(extensionPath, pkg.installPath);
    }

    return extensionPath;
}

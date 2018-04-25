/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { Package } from "./Package";

export class RunTimePackage implements Package {
    description: string;
    url: string;
    fallbackUrl?: string;
    installPath?: string;
    platforms: string[];
    architectures: string[];
    binaries: string[];
    platformId?: string;
    installTestPath?: string;

    constructor(pkg: Package, extensionPath: string) {
        this.description = pkg.description;
        this.url = pkg.url;
        this.fallbackUrl = pkg.fallbackUrl;
        this.installPath = ResolveBaseInstallPath(pkg, extensionPath);
        this.platforms = pkg.platforms;
        this.architectures = pkg.architectures;
        this.binaries = ResolvePackageBinaries(pkg, extensionPath);
        this.platformId = pkg.platformId;
        this.installTestPath = ResolvePackageTestPath(pkg, extensionPath);
    }
}

export function ResolvePackageTestPath(pkg: Package, extensionPath: string): string {
    if (pkg.installTestPath) {
        return path.resolve(extensionPath, pkg.installTestPath);
    }

    return null;
}

function ResolvePackageBinaries(pkg: Package, extensionPath: string) {
    if (pkg.binaries) {
        return pkg.binaries.map(value => path.resolve(ResolveBaseInstallPath(pkg, extensionPath), value));
    }

    return null;
}

function ResolveBaseInstallPath(pkg: Package, extensionPath: string): string {
    if (pkg.installPath) {
        return path.resolve(extensionPath, pkg.installPath);
    }

    return extensionPath;
}

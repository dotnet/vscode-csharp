/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Package } from "./Package";
import { IPackage } from "./IPackage";
import { AbsolutePath } from "./AbsolutePath";

export class AbsolutePathPackage implements IPackage {
    constructor(public id: string,
        public description: string,
        public url: string,
        public platforms: string[],
        public architectures: string[],
        public binaries: AbsolutePath[],
        public installPath?: AbsolutePath,
        public installTestPath?: AbsolutePath,
        public fallbackUrl?: string,
        public platformId?: string,
        public integrity?: string) {
    }

    public static getAbsolutePathPackage(pkg: Package, extensionPath: string) {
        return new AbsolutePathPackage(
            pkg.id,
            pkg.description,
            pkg.url,
            pkg.platforms,
            pkg.architectures,
            getAbsoluteBinaries(pkg, extensionPath),
            getAbsoluteInstallPath(pkg, extensionPath),
            getAbsoluteInstallTestPath(pkg, extensionPath),
            pkg.fallbackUrl,
            pkg.platformId,
            pkg.integrity
        );
    }
}

function getAbsoluteInstallTestPath(pkg: Package, extensionPath: string): AbsolutePath {
    if (pkg.installTestPath) {
        return AbsolutePath.getAbsolutePath(extensionPath, pkg.installTestPath);
    }

    return null;
}

function getAbsoluteBinaries(pkg: Package, extensionPath: string): AbsolutePath[] {
    let basePath = getAbsoluteInstallPath(pkg, extensionPath).value;
    if (pkg.binaries) {
        return pkg.binaries.map(value => AbsolutePath.getAbsolutePath(basePath, value));
    }

    return null;
}

function getAbsoluteInstallPath(pkg: Package, extensionPath: string): AbsolutePath {
    if (pkg.installPath) {
        return AbsolutePath.getAbsolutePath(extensionPath, pkg.installPath);
    }

    return new AbsolutePath(extensionPath);
}
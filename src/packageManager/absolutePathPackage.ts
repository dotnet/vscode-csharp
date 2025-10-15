/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Package } from './package';
import { IPackage } from './IPackage';
import { AbsolutePath } from './absolutePath';

export class AbsolutePathPackage implements IPackage {
    constructor(
        public id: string,
        public description: string,
        public url: string,
        public platforms: string[],
        public architectures: string[],
        public installPath: AbsolutePath,
        public binaries?: AbsolutePath[],
        public installTestPath?: AbsolutePath,
        public fallbackUrl?: string,
        public platformId?: string,
        public integrity?: string,
        public isFramework?: boolean
    ) {}

    public static getAbsolutePathPackage(pkg: Package, extensionPath: string) {
        return new AbsolutePathPackage(
            pkg.id,
            pkg.description,
            pkg.url,
            pkg.platforms,
            pkg.architectures,
            getAbsoluteInstallPath(pkg, extensionPath),
            getAbsoluteBinaries(pkg, extensionPath),
            getAbsoluteInstallTestPath(pkg, extensionPath),
            pkg.fallbackUrl,
            pkg.platformId,
            pkg.integrity,
            pkg.isFramework
        );
    }
}

function getAbsoluteInstallTestPath(pkg: Package, extensionPath: string): AbsolutePath | undefined {
    if (pkg.installTestPath !== undefined) {
        return AbsolutePath.getAbsolutePath(extensionPath, pkg.installTestPath);
    }

    return undefined;
}

function getAbsoluteBinaries(pkg: Package, extensionPath: string): AbsolutePath[] | undefined {
    const basePath = getAbsoluteInstallPath(pkg, extensionPath).value;
    return pkg.binaries?.map((value) => AbsolutePath.getAbsolutePath(basePath, value));
}

function getAbsoluteInstallPath(pkg: Package, extensionPath: string): AbsolutePath {
    if (pkg.installPath !== undefined) {
        return AbsolutePath.getAbsolutePath(extensionPath, pkg.installPath);
    }

    return new AbsolutePath(extensionPath);
}

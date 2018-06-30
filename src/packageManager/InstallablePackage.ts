/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPackage, Package } from "./Package";
import { AbsolutePath } from "./AbsolutePath";
import { getExtensionPath } from "../common";

export class InstallablePackage implements IPackage{
    constructor(public description: string,
        public url: string,
        public platforms: string[],
        public architectures: string[],
        public binaries: AbsolutePath[],
        public installPath?: AbsolutePath,
        public installTestPath?: AbsolutePath, 
        public fallbackUrl?: string,
        public platformId?: string) {
    }

    public static getInstallablePackage(pkg: Package) {
        return new InstallablePackage(
            pkg.description,
            pkg.url,
            pkg.platforms,
            pkg.architectures,
            getAbsoluteBinaries(pkg),
            getAbsoluteInstallPath(pkg),
            getAbsoluteInstallTestPath(pkg),
            pkg.fallbackUrl,
            pkg.platformId
        );
    }
}

function getAbsoluteInstallTestPath(pkg: Package): AbsolutePath { 
    if (pkg.installTestPath) { 
        return AbsolutePath.getAbsolutePath(getExtensionPath(), pkg.installTestPath);
    } 
 
    return null; 
} 
 
function getAbsoluteBinaries(pkg: Package): AbsolutePath[] { 
    let basePath = getAbsoluteInstallPath(pkg).path;
    if (pkg.binaries) { 
        return pkg.binaries.map(value => AbsolutePath.getAbsolutePath(basePath, value)); 
    } 
 
    return null; 
} 
 
function getAbsoluteInstallPath(pkg: Package): AbsolutePath { 
    let basePath = getExtensionPath(); 
    if (pkg.installPath) { 
        return AbsolutePath.getAbsolutePath(basePath, pkg.installPath);
    } 
 
    return new AbsolutePath(basePath); 
} 
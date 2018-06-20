/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPackage } from "./IPackage";
import * as path from "path";
import { PackageError } from "./PackageError";
import { getExtensionPath } from "../common";

export class InstallablePackage implements IPackage {
    description: string;
    url: string;
    fallbackUrl?: string;
    platforms: string[];
    architectures: string[];
    platformId?: string;
    installPath?: string;
    installTestPath?: string;
    binaries: string[];

    constructor(description: string, url: string, platforms: string[], architectures: string[], binaries: string[], fallbackUrl?: string, platformId?: string, installPath?: string, installTestPath?: string) {
        this.description = description;
        this.url = url;
        this.fallbackUrl = fallbackUrl;
        this.platforms = platforms;
        this.architectures = architectures;
        this.platformId = platformId;
        if (installPath) {
            if (!path.isAbsolute(installPath)) {
                throw new PackageError(`Cannot create installable package: installPath - ${installPath} must be absolute`);
            }
            this.installPath = installPath;
        }

        if (installTestPath) {
            if (!path.isAbsolute(installTestPath)) {
                throw new PackageError(`Cannot create installable package: installTestPath - ${installTestPath} must be absolute`);
            }
            this.installTestPath = installTestPath;
        }

        if (binaries) {
            for (let binary of binaries) {
                if (!path.isAbsolute(binary)) {
                    throw new PackageError(`Cannot create installable package - binary path - ${binary} must be absolute`);
                }
            }
        }
    }

    public static getInstallablePackages(packages: IPackage[]): InstallablePackage[]{
        return packages.map(pkg => InstallablePackage.From(pkg));
    }

    static From(pkg: IPackage): InstallablePackage {
        return new InstallablePackage(pkg.description, pkg.url,
            pkg.platforms,
            pkg.architectures,
            getBinariesWithAbsolutePaths(pkg),
            pkg.fallbackUrl,
            pkg.platformId,
            getAbsoluteInstallPath(pkg),
            getAbsoluteInstallTestPath(pkg),
        );
    } 
}


function getAbsoluteInstallTestPath(pkg: IPackage): string {
    if (pkg.installTestPath) {
        return path.resolve(getExtensionPath(), pkg.installTestPath);
    }

    return null;
}

function getBinariesWithAbsolutePaths(pkg: IPackage) {
    let absoluteInstallPath = getAbsoluteInstallPath(pkg);
    if (pkg.binaries) {
        return pkg.binaries.map(value => path.resolve(absoluteInstallPath, value));
    }

    return null;
}

function getAbsoluteInstallPath(pkg: IPackage): string {
    let basePath = getExtensionPath();
    if (pkg.installPath) {
        basePath = path.resolve(basePath, pkg.installPath);
    }

    return basePath;
}

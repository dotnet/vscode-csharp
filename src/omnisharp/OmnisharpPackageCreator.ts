/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Package } from "../packageManager/Package";

export function GetPackagesFromVersion(version: string, runTimeDependencies: Package[], serverUrl: string, installPath: string): Package[] {
    if (!version) {
        throw new Error('Invalid version');
    }

    let versionPackages = new Array<Package>();
    for (let inputPackage of runTimeDependencies) {
        if (inputPackage.platformId) {
            versionPackages.push(SetBinaryAndGetPackage(inputPackage, serverUrl, version, installPath));
        }
    }

    return versionPackages;
}

export function SetBinaryAndGetPackage(inputPackage: Package, serverUrl: string, version: string, installPath: string): Package {
    let installBinary: string;
    if (inputPackage.platformId === "win-x86" || inputPackage.platformId === "win-x64") {
        installBinary = "OmniSharp.exe";
    }
    else {
        installBinary = "run";
    }

    return GetPackage(inputPackage, serverUrl, version, installPath, installBinary);
}

function GetPackage(inputPackage: Package, serverUrl: string, version: string, installPath: string, installBinary: string): Package {
    if (!version) {
        throw new Error('Invalid version');
    }

    let versionPackage: Package = {
        id: inputPackage.id,
        description: `${inputPackage.description}, Version = ${version}`,
        url: `${serverUrl}/releases/${version}/omnisharp-${inputPackage.platformId}.zip`,
        installPath: `${installPath}/${version}`,
        installTestPath: `./${installPath}/${version}/${installBinary}`,
        platforms: inputPackage.platforms,
        architectures: inputPackage.architectures,
        binaries: inputPackage.binaries,
        platformId: inputPackage.platformId
    };

    return versionPackage;
}


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
    if (inputPackage.platformId == "win-x86" || inputPackage.platformId == "win-x64") {
        installBinary = "OmniSharp.exe";
    }
    else if (inputPackage.platformId == "osx") {
        installBinary = "mono.osx";
    }
    else if (inputPackage.platformId == "linux-x86") {
        installBinary = "mono.linux-x86";
    }
    else if (inputPackage.platformId == "linux-x64") {
        installBinary = "mono.linux-x86_64";
    }

    return GetPackage(inputPackage, serverUrl, version, installPath, installBinary);
}

function GetPackage(inputPackage: Package, serverUrl: string, version: string, installPath: string, installBinary: string): Package {
    if (!version) {
        throw new Error('Invalid version');
    }

    let versionPackage = {...inputPackage,
        "description": `${inputPackage.description}, Version = ${version}`,
        "url": `${serverUrl}/releases/${version}/omnisharp-${inputPackage.platformId}.zip`,
        "installPath": `${installPath}/${version}`,
        "installTestPath": `./${installPath}/${version}/${installBinary}`,
        "fallbackUrl": "" //setting to empty so that we dont use the fallback url of the default packages
    };

    return versionPackage;
}


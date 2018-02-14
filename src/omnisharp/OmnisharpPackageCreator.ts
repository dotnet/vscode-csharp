/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Package } from "../packages";

export function GetPackagesFromVersion(version: string, runTimeDependencies: Package[], serverUrl: string, installPath: string): Package[] {
    if (!version) {
        throw new Error('Invalid version');
    }

    let versionPackages = new Array<Package>();
    for (let inputPackage of runTimeDependencies) {
        if (inputPackage.experimentalPackageId) {
            versionPackages.push(GetOmnisharpPackage(inputPackage, serverUrl, version, installPath));
        }
    }

    return versionPackages;
}

export function GetOmnisharpPackage(inputPackage: Package, serverUrl: string, version: string, installPath: string): Package {
    let installBinary: string;
    if (inputPackage.experimentalPackageId == "win-x86" || inputPackage.experimentalPackageId == "win-x64") {
        installBinary = "OmniSharp.exe";
    }
    else if (inputPackage.experimentalPackageId == "osx") {
        installBinary = "mono.osx";
    }
    else if (inputPackage.experimentalPackageId == "linux-x86") {
        installBinary = "mono.linux-x86";
    }
    else if (inputPackage.experimentalPackageId == "linux-x64") {
        installBinary = "mono.linux-x86_64";
    }

    return GetPackageFromArchitecture(inputPackage, serverUrl, version, inputPackage.experimentalPackageId, installPath, installBinary);
}

function GetPackageFromArchitecture(inputPackage: Package, serverUrl: string, version: string, architectureInfo: string, installPath: string, installBinary: string): Package {
    if (!version) {
        throw new Error('Invalid version');
    }

    let versionPackage = <Package>{
        "description": `${inputPackage.description}, Version = ${version}`,
        "url": `${serverUrl}/releases/${version}/omnisharp-${architectureInfo}.zip`,
        "installPath": `${installPath}/${version}`,
        "platforms": inputPackage.platforms,
        "architectures": inputPackage.architectures,
        "binaries": inputPackage.binaries,
        "installTestPath": `./${installPath}/${version}/${installBinary}`,
        "experimentalPackageId": architectureInfo
    };

    return versionPackage;
}

export function GetVersionFilePackage(serverUrl: string, pathInServer: string): Package {
    let filePackage = <Package>{
        "description": "Latest version information file",
        "url": `${serverUrl}/${pathInServer}`
    };

    return filePackage;
}

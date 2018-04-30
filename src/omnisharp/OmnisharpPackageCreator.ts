/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PackageJSONPackage } from "../packageManager/PackageJSONPackage";

export function GetPackagesFromVersion(version: string, runTimeDependencies: PackageJSONPackage[], serverUrl: string, installPath: string): PackageJSONPackage[] {
    if (!version) {
        throw new Error('Invalid version');
    }

    let versionPackages = new Array<PackageJSONPackage>();
    for (let inputPackage of runTimeDependencies) {
        if (inputPackage.platformId) {
            //transform the omnisharp packages and push the others directly
            versionPackages.push(SetBinaryAndGetPackage(inputPackage, serverUrl, version, installPath));
        }
        else {
            versionPackages.push(inputPackage);
        }
    }

    return versionPackages;
}

export function SetBinaryAndGetPackage(inputPackage: PackageJSONPackage, serverUrl: string, version: string, installPath: string): PackageJSONPackage {
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

    return <PackageJSONPackage>{
        description: `${inputPackage.description}, Version = ${version}`,
        url: `${serverUrl}/releases/${version}/omnisharp-${inputPackage.platformId}.zip`,
        installPath: `${installPath}/${version}`,
        platforms: inputPackage.platforms,
        architectures: inputPackage.architectures,
        binaries: inputPackage.binaries,
        installTestPath: `./${installPath}/${version}/${installBinary}`
    };
}
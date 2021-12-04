/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Package } from "../packageManager/Package";

export const modernNetVersion = "6.0";

export function GetPackagesFromVersion(version: string, useFramework: boolean, runTimeDependencies: Package[], serverUrl: string, installPath: string): Package[] {
    if (!version) {
        throw new Error('Invalid version');
    }

    let versionPackages = new Array<Package>();
    for (let inputPackage of runTimeDependencies) {
        if (inputPackage.platformId && inputPackage.isFramework === useFramework) {
            versionPackages.push(SetBinaryAndGetPackage(inputPackage, useFramework, serverUrl, version, installPath));
        }
    }

    return versionPackages;
}

export function SetBinaryAndGetPackage(inputPackage: Package, useFramework: boolean, serverUrl: string, version: string, installPath: string): Package {
    let installBinary: string;
    if (!useFramework) {
        // .NET 6 packages use system `dotnet OmniSharp.dll`
        installBinary = 'OmniSharp.dll';
    }
    else if (inputPackage.platformId === 'win-x86' || inputPackage.platformId === 'win-x64' || inputPackage.platformId === 'win-arm64') {
        installBinary = 'OmniSharp.exe';
    }
    else {
        installBinary = 'run';
    }

    return GetPackage(inputPackage, useFramework, serverUrl, version, installPath, installBinary);
}

function GetPackage(inputPackage: Package, useFramework: boolean, serverUrl: string, version: string, installPath: string, installBinary: string): Package {
    if (!version) {
        throw new Error('Invalid version');
    }

    const packageSuffix = useFramework ? '' : `-net${modernNetVersion}`;

    let versionPackage: Package = {
        id: inputPackage.id,
        description: `${inputPackage.description}, Version = ${version}`,
        url: `${serverUrl}/releases/${version}/omnisharp-${inputPackage.platformId}${packageSuffix}.zip`,
        installPath: `${installPath}/${version}${packageSuffix}`,
        installTestPath: `./${installPath}/${version}${packageSuffix}/${installBinary}`,
        platforms: inputPackage.platforms,
        architectures: inputPackage.architectures,
        binaries: inputPackage.binaries,
        platformId: inputPackage.platformId,
        isFramework: useFramework
    };

    return versionPackage;
}


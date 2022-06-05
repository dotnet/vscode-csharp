/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Package } from "../packageManager/Package";

export const modernNetVersion = "6.0";

export function GetPackagesFromVersion(version: string, useFramework: boolean, runTimeDependencies: Package[], serverUrl: string, installPath: string): Package[] {
    return runTimeDependencies
        .filter(inputPackage =>
            inputPackage.platformId !== undefined && inputPackage.isFramework === useFramework)
        .map(inputPackage =>
            SetBinaryAndGetPackage(inputPackage, useFramework, serverUrl, version, installPath));
}

export function SetBinaryAndGetPackage(inputPackage: Package, useFramework: boolean, serverUrl: string, version: string, installPath: string): Package {
    let installBinary: string;
    if (!useFramework) {
        // .NET 6 packages use system `dotnet OmniSharp.dll`
        installBinary = 'OmniSharp.dll';
    }
    else if (inputPackage.platforms.includes('win32')) {
        installBinary = 'OmniSharp.exe';
    }
    else {
        installBinary = 'run';
    }

    return GetPackage(inputPackage, useFramework, serverUrl, version, installPath, installBinary);
}

function GetPackage(inputPackage: Package, useFramework: boolean, serverUrl: string, version: string, installPath: string, installBinary: string): Package {
    const packageSuffix = useFramework ? '' : `-net${modernNetVersion}`;

    return {
        ...inputPackage,
        description: `${inputPackage.description}, Version = ${version}`,
        url: `${serverUrl}/releases/${version}/omnisharp-${inputPackage.platformId}${packageSuffix}.zip`,
        installPath: `${installPath}/${version}${packageSuffix}`,
        installTestPath: `./${installPath}/${version}${packageSuffix}/${installBinary}`,
    };
}

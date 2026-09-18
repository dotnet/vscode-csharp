/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Package } from '../packageManager/package';
import * as semver from 'semver';

export function getModernNetVersion(version: string): string {
    // OmniSharp 1.39.16 moved modern packages from .NET 6 to .NET 10.
    const normalizedVersion = semver.coerce(version);
    return normalizedVersion && semver.gte(normalizedVersion, '1.39.16') ? '10.0' : '6.0';
}

export function getPackageSuffix(version: string, useFramework: boolean): string {
    const normalizedVersion = semver.coerce(version);
    if (useFramework || (normalizedVersion && semver.gte(normalizedVersion, '2.0.0'))) {
        return '';
    }

    return `-net${getModernNetVersion(version)}`;
}

export function GetPackagesFromVersion(
    version: string,
    useFramework: boolean,
    runTimeDependencies: Package[],
    serverUrl: string,
    installPath: string
): Package[] {
    return runTimeDependencies
        .filter((inputPackage) => inputPackage.platformId !== undefined && inputPackage.isFramework === useFramework)
        .map((inputPackage) => SetBinaryAndGetPackage(inputPackage, useFramework, serverUrl, version, installPath));
}

export function SetBinaryAndGetPackage(
    inputPackage: Package,
    useFramework: boolean,
    serverUrl: string,
    version: string,
    installPath: string
): Package {
    let installBinary: string;
    if (!useFramework) {
        // Modern .NET packages use system `dotnet OmniSharp.dll`.
        installBinary = 'OmniSharp.dll';
    } else if (inputPackage.platforms.includes('win32')) {
        installBinary = 'OmniSharp.exe';
    } else {
        installBinary = 'run';
    }

    return GetPackage(inputPackage, useFramework, serverUrl, version, installPath, installBinary);
}

function GetPackage(
    inputPackage: Package,
    useFramework: boolean,
    serverUrl: string,
    version: string,
    installPath: string,
    installBinary: string
): Package {
    const packageSuffix = getPackageSuffix(version, useFramework);

    return {
        ...inputPackage,
        integrity: undefined,
        description: `${inputPackage.description}, Version = ${version}`,
        url: `${serverUrl}/releases/download/v${version}/omnisharp-${inputPackage.platformId}${packageSuffix}.zip`,
        installPath: `${installPath}/${version}${packageSuffix}`,
        installTestPath: `./${installPath}/${version}${packageSuffix}/${installBinary}`,
    };
}

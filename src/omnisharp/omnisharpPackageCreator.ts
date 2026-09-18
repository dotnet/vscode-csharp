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

export function getPackageSuffix(version: string): string {
    const normalizedVersion = semver.coerce(version);
    if (normalizedVersion && semver.gte(normalizedVersion, '2.0.0')) {
        return '';
    }

    return `-net${getModernNetVersion(version)}`;
}

export function GetPackagesFromVersion(
    version: string,
    runTimeDependencies: Package[],
    serverUrl: string,
    installPath: string
): Package[] {
    return runTimeDependencies
        .filter((inputPackage) => inputPackage.id === 'OmniSharp' && inputPackage.platformId !== undefined)
        .map((inputPackage) => SetBinaryAndGetPackage(inputPackage, serverUrl, version, installPath));
}

export function SetBinaryAndGetPackage(
    inputPackage: Package,
    serverUrl: string,
    version: string,
    installPath: string
): Package {
    return GetPackage(inputPackage, serverUrl, version, installPath);
}

function GetPackage(inputPackage: Package, serverUrl: string, version: string, installPath: string): Package {
    const packageSuffix = getPackageSuffix(version);

    return {
        ...inputPackage,
        integrity: undefined,
        description: `${inputPackage.description}, Version = ${version}`,
        url: `${serverUrl}/releases/download/v${version}/omnisharp-${inputPackage.platformId}${packageSuffix}.zip`,
        installPath: `${installPath}/${version}${packageSuffix}`,
        installTestPath: `./${installPath}/${version}${packageSuffix}/OmniSharp.dll`,
    };
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getInstallablePackages } from "../packageManager/getInstallablePackage";
import { RuntimeDependency, InstallablePackage } from "../packageManager/Package";

export function GetPackagesFromVersion(version: string, runTimeDependencies: RuntimeDependency[], serverUrl: string, installPath: string): InstallablePackage[] {
    if (!version) {
        throw new Error('Invalid version');
    }

    let versionPackages = new Array<RuntimeDependency>();
    for (let inputPackage of runTimeDependencies) {
        versionPackages.push(SetBinaryAndGetPackage(inputPackage, serverUrl, version, installPath));
    }

    return getInstallablePackages(versionPackages);
}

export function SetBinaryAndGetPackage(inputPackage: RuntimeDependency, serverUrl: string, version: string, installPath: string): RuntimeDependency {
    let installBinary: string;
    if (inputPackage.platformId === "win-x86" || inputPackage.platformId === "win-x64") {
        installBinary = "OmniSharp.exe";
    }
    else {
        installBinary = "run";
    }

    return GetPackage(inputPackage, serverUrl, version, installPath, installBinary);
}

function GetPackage(inputPackage: RuntimeDependency, serverUrl: string, version: string, installPath: string, installBinary: string): RuntimeDependency {
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


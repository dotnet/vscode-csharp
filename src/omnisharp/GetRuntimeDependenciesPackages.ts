/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Package } from "../packageManager/Package";
import { ResolveFilePaths } from "../packageManager/PackageFilePathResolver";
 
export function getRuntimeDependenciesPackages(packageJSON: any): Package[] {
    if (packageJSON.runtimeDependencies) {
        let packages = <Package[]>JSON.parse(JSON.stringify(<Package[]>packageJSON.runtimeDependencies));
        packages.forEach(pkg => ResolveFilePaths(pkg));
        return packages;
    }

    throw new Error("No runtime dependencies found");
}
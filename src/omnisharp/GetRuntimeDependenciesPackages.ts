/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RuntimeDependency, InstallablePackage } from "../packageManager/Package";
import { getInstallablePackage } from "../packageManager/getInstallablePackage";
 
export function getInstallableRuntimeDependencies(packageJSON: any): InstallablePackage[] {
    if (packageJSON.runtimeDependencies) {
        let runtimeDependencies = <RuntimeDependency[]>packageJSON.runtimeDependencies;
        return runtimeDependencies.map(pkg => getInstallablePackage(pkg));
    }

    throw new Error("No runtime dependencies found");
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RuntimeDependency, InstallablePackage } from "../packageManager/Package";
import { getInstallablePackages } from "../packageManager/getInstallablePackage";

 
export function getInstallableRuntimeDependencies(packageJSON: any): InstallablePackage[] {
    if (packageJSON.runtimeDependencies) {
        let runtimeDependencies = <RuntimeDependency[]>packageJSON.runtimeDependencies;
        return getInstallablePackages(runtimeDependencies);
    }

    throw new Error("No runtime dependencies found");
}
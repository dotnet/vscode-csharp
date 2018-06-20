/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPackage } from "../packageManager/IPackage";
import { InstallablePackage } from "../packageManager/InstallablePackage";

export function getCSharpExtDependencies(packageJSON: any): InstallablePackage[] {
    if (packageJSON.runtimeDependencies) {
        let runtimeDependencies = <IPackage[]>packageJSON.runtimeDependencies;
        return InstallablePackage.getInstallablePackages(runtimeDependencies);
    }

    throw new Error("No runtime dependencies found");
}
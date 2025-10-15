/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AbsolutePathPackage } from './absolutePathPackage';

export type DependencyInstallationResults = { [name: string]: boolean };

export interface IInstallDependencies {
    (packages: AbsolutePathPackage[]): Promise<DependencyInstallationResults>;
}

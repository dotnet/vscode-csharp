/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPackage } from "./IPackage";

export interface Package extends IPackage {
    installPath?: string;
    binaries?: string[];
    installTestPath?: string;
}

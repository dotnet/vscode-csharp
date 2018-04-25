/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface PackageJSONPackage {
    description: string;
    version?: string;
    url: string;
    fallbackUrl?: string;
    installPath?: string;
    platforms: string[];
    architectures: string[];
    binaries: string[];
    platformId?: string;
    // Path to use to test if the package has already been installed
    installTestPath?: string;
}

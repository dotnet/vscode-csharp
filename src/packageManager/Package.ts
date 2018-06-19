/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


export interface IPackage {
    description: string;
    url: string;
    fallbackUrl?: string;
    platforms: string[];
    architectures: string[];
    platformId?: string;
}

export interface InstallablePackage extends IPackage { 
    absoluteInstallPath?: string;
    absoluteInstallTestPath?: string;
    absoluteBinaryPaths: string[];
}

export interface RuntimeDependency extends IPackage { 
    installPath?: string;
    installTestPath?: string;
    binaries: string[];
}

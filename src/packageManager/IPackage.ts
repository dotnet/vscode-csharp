/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IPackage {
    id?: string;
    description: string;
    url: string;
    fallbackUrl?: string;
    platforms: string[];
    architectures: string[];
    platformId?: string;
    integrity?: string;
}
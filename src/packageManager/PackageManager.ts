/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../platform";
import { Package } from './Package';
import { PackageError } from './PackageError';
import { NestedError } from "../NestedError";
import { DownloadFile } from './FileDownloader';
import { InstallZip } from './ZipInstaller';
import { EventStream } from '../EventStream';
import { NetworkSettingsProvider } from "../NetworkSettings";
import { filterPackages } from "./PackageFilterer";
import { AbsolutePathPackage } from "./AbsolutePathPackage";

export async function DownloadAndInstallPackages(packages: Package[], provider: NetworkSettingsProvider, platformInfo: PlatformInformation, eventStream: EventStream, extensionPath: string) {
    let absolutePathPackages = packages.map(pkg => AbsolutePathPackage.getAbsolutePathPackage(pkg, extensionPath));
    let filteredPackages = await filterPackages(absolutePathPackages, platformInfo);
    if (filteredPackages) {
        for (let pkg of filteredPackages) {
            try {
                let buffer = await DownloadFile(pkg.description, eventStream, provider, pkg.url, pkg.fallbackUrl);
                await InstallZip(buffer, pkg.description, pkg.installPath, pkg.binaries, eventStream);
            }
            catch (error) {
                if (error instanceof NestedError) {
                    throw new PackageError(error.message, pkg, error.err);
                }
                else {
                    throw error;
                }
            }
        }
    }
}


/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../platform";
import { PackageError } from './PackageError';
import { NestedError } from "../NestedError";
import { DownloadFile } from './FileDownloader';
import { InstallZip } from './ZipInstaller';
import { EventStream } from '../EventStream';
import { NetworkSettingsProvider } from "../NetworkSettings";
import { InstallablePackage } from "./Package";

export async function DownloadAndInstallPackages(packages: InstallablePackage[], provider: NetworkSettingsProvider, platformInfo: PlatformInformation, eventStream: EventStream) {
    if (packages) {
        for (let pkg of packages) {
            try {
                let buffer = await DownloadFile(pkg.description, eventStream, provider, pkg.url, pkg.fallbackUrl);
                await InstallZip(buffer, pkg.description, pkg.absoluteInstallPath, pkg.absoluteBinaryPaths, eventStream);
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


/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as util from './common';
import { GetNetworkConfiguration, GetStatus } from './downloader.helper';
import { PackageManager } from './packages';
import { PlatformInformation } from './platform';
import { PackageInstallation, PlatformInfoEvent, InstallationSuccess, InstallationFailure } from './omnisharp/loggingEvents';
import { EventStream } from './EventStream';

/*
 * Class used to download the runtime dependencies of the C# Extension
 */
export class CSharpExtDownloader {
    public constructor(
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation) {
    }

    public async installRuntimeDependencies(): Promise<boolean> {
        this.eventStream.post(new PackageInstallation("C# dependencies" ));

        let status = GetStatus();
        let installationStage = 'touchBeginFile';
        let success = false;

        try {
            await util.touchInstallFile(util.InstallFileType.Begin);

            let packageManager = new PackageManager(this.platformInfo, this.packageJSON);
            // Display platform information and RID
            this.eventStream.post(new PlatformInfoEvent(this.platformInfo ));

            installationStage = 'downloadPackages';

            let networkConfiguration = GetNetworkConfiguration();
            const proxy = networkConfiguration.Proxy;
            const strictSSL = networkConfiguration.StrictSSL;

            await packageManager.DownloadPackages(this.eventStream, status, proxy, strictSSL);

            installationStage = 'installPackages';
            await packageManager.InstallPackages(this.eventStream, status);

            installationStage = 'touchLockFile';
            await util.touchInstallFile(util.InstallFileType.Lock);

            success = true;
            this.eventStream.post(new InstallationSuccess());
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure(installationStage, error));
        }
        finally {
            status.dispose();
            // We do this step at the end so that we clean up the begin file in the case that we hit above catch block
            // Attach a an empty catch to this so that errors here do not propogate
            try {
                util.deleteInstallFile(util.InstallFileType.Begin);
            }
            catch (error) { }
            return success;
        }
    }
}

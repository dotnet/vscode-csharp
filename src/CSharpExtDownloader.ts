/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as util from './common';
import { PlatformInformation } from './platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure } from './omnisharp/loggingEvents';
import { EventStream } from './EventStream';
import { vscode } from './vscodeAdapter';
import { PackageManager } from './packageManager/PackageManager';
import { Package } from './packageManager/packages';

/*
 * Class used to download the runtime dependencies of the C# Extension
 */
export class CSharpExtDownloader {
    private packageManager: PackageManager;

    public constructor(
        private vscode: vscode,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation) {
        this.packageManager = new PackageManager();
    }

    public async installRuntimeDependencies(): Promise<boolean> {
        this.eventStream.post(new PackageInstallation("C# dependencies"));
        let installationStage = 'touchBeginFile';
        let success = false;

        try {
            await util.touchInstallFile(util.InstallFileType.Begin);
            
            // Display platform information and RID
            this.eventStream.post(new LogPlatformInfo(this.platformInfo));

            let runTimeDependencies = this.GetRunTimeDependenciesPackages();
            
            installationStage = 'downloadAndInstallPackages';
            await this.packageManager.DownloadAndInstallPackages(runTimeDependencies, this.vscode, this.platformInfo, this.eventStream);

            // We probably dont need the install.Lock thing now as we are directly testing the package test path
            installationStage = 'touchLockFile';
            await util.touchInstallFile(util.InstallFileType.Lock);

            success = true;
            this.eventStream.post(new InstallationSuccess());
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure(installationStage, error));
        }
        finally {
            // We do this step at the end so that we clean up the begin file in the case that we hit above catch block
            // Attach a an empty catch to this so that errors here do not propogate
            try {
                util.deleteInstallFile(util.InstallFileType.Begin);
            }
            catch (error) { }
            return success;
        }
    }

    public GetRunTimeDependenciesPackages(): Package[] {
        if (this.packageJSON.runtimeDependencies) {
            return JSON.parse(JSON.stringify(<Package[]>this.packageJSON.runtimeDependencies));
        }

        return null;
    }    
}

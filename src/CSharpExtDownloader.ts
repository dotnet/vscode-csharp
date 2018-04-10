/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as util from './common';
import { GetNetworkConfiguration, defaultPackageManagerFactory, IPackageManagerFactory } from './downloader.helper';
import { PackageManager } from './packages';
import { PlatformInformation } from './platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure } from './omnisharp/loggingEvents';
import { EventStream } from './EventStream';
import { vscode } from './vscodeAdapter';

/*
 * Class used to download the runtime dependencies of the C# Extension
 */
export class CSharpExtDownloader {
    private proxy: string;
    private strictSSL: boolean;
    private packageManager: PackageManager;

    public constructor(
        vscode: vscode,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation,
        packageManagerFactory: IPackageManagerFactory = defaultPackageManagerFactory) {

        let networkConfiguration = GetNetworkConfiguration(vscode);
        this.proxy = networkConfiguration.Proxy;
        this.strictSSL = networkConfiguration.StrictSSL;
        this.packageManager = packageManagerFactory(this.platformInfo);
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
            installationStage = 'downloadPackages';
                       
            let downloadedPackages = await this.packageManager.DownloadPackages(runTimeDependencies, this.eventStream, this.proxy, this.strictSSL);

            installationStage = 'installPackages';
            await this.packageManager.InstallPackages(downloadedPackages,this.eventStream);

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

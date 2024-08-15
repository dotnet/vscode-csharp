/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GetPackagesFromVersion } from './omnisharpPackageCreator';
import { PlatformInformation } from '../shared/platform';
import {
    PackageInstallation,
    LogPlatformInfo,
    InstallationSuccess,
    InstallationFailure,
} from '../shared/loggingEvents';
import { EventStream } from '../eventStream';
import { NetworkSettingsProvider } from '../networkSettings';
import { downloadAndInstallPackages } from '../packageManager/downloadAndInstallPackages';
import { getRuntimeDependenciesPackages } from '../tools/runtimeDependencyPackageUtils';
import { getAbsolutePathPackagesToInstall } from '../packageManager/getAbsolutePathPackagesToInstall';
import { isValidDownload } from '../packageManager/isValidDownload';
import { LatestBuildDownloadStart } from './omnisharpLoggingEvents';
import * as https from 'https';
import { DownloadFailure } from '../shared/loggingEvents';
import { NestedError } from '../nestedError';
import { parse as parseUrl } from 'url';
import { getProxyAgent } from '../packageManager/proxy';

export class OmnisharpDownloader {
    public constructor(
        private networkSettingsProvider: NetworkSettingsProvider,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation,
        private extensionPath: string
    ) {}

    public async DownloadAndInstallOmnisharp(
        version: string,
        useFramework: boolean,
        serverUrl: string,
        installPath: string
    ): Promise<boolean> {
        const runtimeDependencies = getRuntimeDependenciesPackages(this.packageJSON);
        const omniSharpPackages = GetPackagesFromVersion(
            version,
            useFramework,
            runtimeDependencies,
            serverUrl,
            installPath
        );
        const packagesToInstall = await getAbsolutePathPackagesToInstall(
            omniSharpPackages,
            this.platformInfo,
            this.extensionPath
        );
        if (packagesToInstall.length > 0) {
            this.eventStream.post(new PackageInstallation(`OmniSharp Version = ${version}`));
            this.eventStream.post(new LogPlatformInfo(this.platformInfo));
            if (
                await downloadAndInstallPackages(
                    packagesToInstall,
                    this.networkSettingsProvider,
                    this.eventStream,
                    isValidDownload
                )
            ) {
                this.eventStream.post(new InstallationSuccess());
                return true;
            }
        }
        return false;
    }

    public async GetLatestVersion(serverUrl: string): Promise<string> {
        const url = `${serverUrl}/releases?per_page=1`;
        try {
            this.eventStream.post(new LatestBuildDownloadStart());
            const releases = await this.fetchLatestReleases(url);
            const latestRelease = releases[0];
            return latestRelease.tag_name.replace('v', '');
        } catch (error) {
            this.eventStream.post(new InstallationFailure('getLatestVersionInfoFile', error));
            throw error;
        }
    }

    public async fetchLatestReleases(urlString: string): Promise<any> {
        const url = parseUrl(urlString);
        const networkSettings = this.networkSettingsProvider();
        const proxy = networkSettings.proxy;
        const strictSSL = networkSettings.strictSSL;
        const options: https.RequestOptions = {
            method: 'GET',
            host: url.hostname,
            path: url.path,
            agent: getProxyAgent(url, proxy, strictSSL),
            port: url.port,
            headers: { Accept: 'application/vnd.github.v3+json' },
            rejectUnauthorized: strictSSL,
        };

        return new Promise<any>((resolve, reject) => {
            const request = https.request(options, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    // Redirect - download from new location
                    if (response.headers.location === undefined) {
                        this.eventStream.post(
                            new DownloadFailure(
                                `Failed to download from ${urlString}. Redirected without location header`
                            )
                        );
                        return reject(new NestedError('Missing location'));
                    }
                    return resolve(this.fetchLatestReleases(response.headers.location));
                } else if (response.statusCode !== 200) {
                    // Download failed - print error message
                    this.eventStream.post(
                        new DownloadFailure(
                            `Failed to download from ${urlString}. Error code '${response.statusCode}')`
                        )
                    );
                    return reject(new NestedError(response.statusCode!.toString())); // Known to exist because this is from a ClientRequest
                }

                let body = '';

                response.on('data', function (chunk) {
                    body = body + chunk;
                });

                response.on('end', () => {
                    resolve(JSON.parse(body));
                });

                response.on('error', (err) => {
                    reject(
                        new NestedError(
                            `Failed to download from ${urlString}. Error Message: ${err.message || 'NONE'}`,
                            err
                        )
                    );
                });
            });

            request.on('error', (err) => {
                reject(new NestedError(`Request error: ${err.message || 'NONE'}`, err));
            });

            // Execute the request
            request.end();
        });
    }
}

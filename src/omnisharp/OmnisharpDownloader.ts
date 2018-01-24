/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';

export class OmnisharpDownloader {

    public GetLatestInstalledExperimentalVersion(basePath: string) {
        const semver = require('semver');

        let latestVersion: string;
        if (fs.existsSync(basePath)) {
            let installedItems = fs.readdirSync(basePath);
            if (installedItems && installedItems.length > 0) {
                let validVersions = installedItems.filter(value => semver.valid(value));
                if (validVersions && validVersions.length > 0) {
                    latestVersion = validVersions.reduce((latestTillNow, element) => {
                        if (semver.gt(latestTillNow, element)) {
                            return latestTillNow;
                        }

                        return element;
                    });
                }
            }
        }

        return latestVersion;
    }
}
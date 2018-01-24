/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as utils from '../common';
import * as fs from 'fs';

export class OmnisharpDownloader {

    public GetLatestInstalledExperimentalVersion(): string {
        let basePath = path.resolve(utils.getExtensionPath(), ".omnisharp/experimental");
        const semver = require('semver');

        let latestVersion: string;
        let installedItems = fs.readdirSync(basePath);
        if (installedItems) {
            let validVersions = installedItems.filter(value => semver.valid(value));
            if(validVersions){
                latestVersion = validVersions.reduce((latestTillNow, element) => {
                    if (semver.gt(latestTillNow, element)) {
                        return latestTillNow;
                    }
    
                    return element;
                });
            }
        }

        return latestVersion;
    }
}
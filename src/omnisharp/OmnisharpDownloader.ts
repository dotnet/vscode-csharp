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
        let compareVersions = require('compare-versions');

        let latestVersion: string;
        let items = fs.readdirSync(basePath);
        if (items) {
            latestVersion = items.reduce((latest, cur) => {
                if (compareVersions(latest, cur)) {
                    return cur;
                }

                return latest;
            });
        }

        return latestVersion;
    }
}
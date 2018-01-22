/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as utils from '../common';
import * as fs from 'fs';

export class OmnisharpDownloader {

    public GetLatestExperimentVersion(): string {
        let basePath = path.resolve(utils.getExtensionPath(), ".omnisharp/experiment");
        let compareVersions = require('compare-versions');
        let latestVersion: string;
        let items = fs.readdirSync(basePath);
        if (items) {
            items.sort(compareVersions);
            latestVersion = items[items.length - 1];
            //get the latest version after sorting
        }

        return latestVersion;
    }
}
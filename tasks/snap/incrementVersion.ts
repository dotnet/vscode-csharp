/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addChangelogSection, getNextPrereleaseVersion, readVersionJson, writeVersionJson } from './snapTasks';
import { runTask } from '../runTask';

runTask(incrementVersion);

async function incrementVersion(): Promise<void> {
    // Get the current version from version.json
    const versionJson = readVersionJson();

    const newVersion = getNextPrereleaseVersion(versionJson.version);
    console.log(`Updating ${versionJson.version} to ${newVersion}`);

    // Write the new version back to version.json
    versionJson.version = newVersion;
    writeVersionJson(versionJson);

    // Add a new changelog section for the new version.
    addChangelogSection(newVersion);
}

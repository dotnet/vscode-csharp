/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readVersionJson, getNextReleaseVersion, writeVersionJson, addChangelogSection } from './snapTasks';
import { runTask } from '../runTask';

runTask(updateVersionForStableRelease);

/**
 * Update version.json to the next stable release version.
 * This task is used when snapping from prerelease to release.
 * It updates the version to round up to the next tens version (e.g., 2.74 -> 2.80).
 */
async function updateVersionForStableRelease(): Promise<void> {
    // Get the current version from version.json
    const versionJson = readVersionJson();

    const currentVersion = versionJson.version as string;
    const releaseVersion = getNextReleaseVersion(currentVersion);

    console.log(`Updating version from ${currentVersion} to stable release version ${releaseVersion}`);

    // Write the new version back to version.json
    versionJson.version = releaseVersion;
    writeVersionJson(versionJson);

    // Add a new changelog section for the release version that references the prerelease
    addChangelogSection(releaseVersion, [`* See ${currentVersion}.x for full list of changes.`]);
}

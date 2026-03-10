/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import minimist from 'minimist';
import { addChangelogSection, getNextReleaseVersion, readVersionJson, writeVersionJson } from './snapTasks';
import { runTask } from '../runTask';

runTask(incrementVersion);

async function incrementVersion(): Promise<void> {
    const argv = minimist(process.argv.slice(2));
    const isReleaseCandidate = argv['releaseCandidate'] === true || argv['releaseCandidate'] === 'true';

    // Get the current version from version.json
    const versionJson = readVersionJson();

    // Calculate new version
    let version = versionJson.version as string;
    if (isReleaseCandidate) {
        version = getNextReleaseVersion(version);
        console.log(`Release candidate, using base version of ${version}`);
    }

    const split = version.split('.');
    const newVersion = `${split[0]}.${parseInt(split[1]) + 1}`;
    console.log(`Updating ${versionJson.version} to ${newVersion}`);

    // Write the new version back to version.json
    versionJson.version = newVersion;
    writeVersionJson(versionJson);

    // Add a new changelog section for the new version.
    addChangelogSection(newVersion);
}

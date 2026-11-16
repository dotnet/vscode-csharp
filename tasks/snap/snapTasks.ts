/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { rootPath } from '../projectPaths';

/**
 * Calculate the next release (stable) version from the current version.
 * Stable releases use even minor versions.
 * @param currentVersion The current version in "major.minor" format (e.g., "11.3")
 * @returns The next stable release version (e.g., "11.4")
 */
export function getNextReleaseVersion(currentVersion: string): string {
    const [major, minor] = parseVersion(currentVersion);
    if (minor % 2 === 0) {
        throw new Error(`Cannot advance release from ${currentVersion}: prerelease must have an odd minor version.`);
    }
    return `${major}.${minor + 1}`;
}

/**
 * Calculate the next prerelease version.
 * Prereleases use odd minor versions.
 */
export function getNextPrereleaseVersion(currentVersion: string): string {
    const [major, minor] = parseVersion(currentVersion);
    if (minor % 2 === 0) {
        throw new Error(`Cannot advance prerelease from ${currentVersion}: main must have an odd minor version.`);
    }
    return `${major}.${minor + 2}`;
}

function parseVersion(version: string): [number, number] {
    const match = /^(\d+)\.(\d+)$/.exec(version);
    const major = Number(match?.[1]);
    const minor = Number(match?.[2]);
    if (!match || !Number.isSafeInteger(major) || !Number.isSafeInteger(minor)) {
        throw new Error(`Invalid version "${version}": expected "major.minor" with nonnegative integers.`);
    }
    return [major, minor];
}

/**
 * Read and parse version.json
 * @returns The parsed version.json object
 */
export function readVersionJson(): { version: string; [key: string]: unknown } {
    const versionFilePath = path.join(rootPath, 'version.json');
    const file = fs.readFileSync(versionFilePath, 'utf8');
    return JSON.parse(file);
}

/**
 * Write version.json with the given version
 * @param versionJson The version.json object to write
 */
export function writeVersionJson(versionJson: { version: string; [key: string]: unknown }): void {
    const versionFilePath = path.join(rootPath, 'version.json');
    const newJson = JSON.stringify(versionJson, null, 4);
    console.log(`New json: ${newJson}`);
    fs.writeFileSync(versionFilePath, newJson);
}

/**
 * Add a new version section to the changelog
 * @param version The version to add (e.g., "11.3")
 * @param additionalLines Optional additional lines to add after the version header
 */
export function addChangelogSection(version: string, additionalLines?: string[]): void {
    console.log('Adding new version header to changelog');

    const changelogPath = path.join(rootPath, 'CHANGELOG.md');
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    const changelogLines = changelogContent.split(os.EOL);

    // Find all the headers in the changelog (and their line numbers)
    const headerRegex = /^#+\s+.*$/gm;
    const matches = [];
    for (let i = 0; i < changelogLines.length; i++) {
        const line = changelogLines[i];
        const match = headerRegex.exec(line!);
        if (match) {
            matches.push({ line: i, text: match[0] });
        }
    }

    // Find the known issues header, then find the next header after it.
    const knownIssuesHeader = matches.find((m) => m.text.includes('Known Issues'));
    if (knownIssuesHeader === undefined) {
        throw new Error('Could not find the known issues header in the changelog.');
    }
    const knownIssuesIndex = matches.indexOf(knownIssuesHeader);
    if (knownIssuesIndex === -1) {
        throw new Error('Could not find the known issues index in the matches.');
    }

    // Insert a new header for the new version after the known issues header but before the next header.
    const lineToInsertAt = matches[knownIssuesIndex + 1].line - 1;
    console.log(`Inserting new version header at line ${lineToInsertAt}`);
    const linesToInsert = ['', `# ${version}.x`];

    // Add any additional lines if provided
    if (additionalLines && additionalLines.length > 0) {
        linesToInsert.push(...additionalLines);
    }

    changelogLines.splice(lineToInsertAt, 0, ...linesToInsert);
    fs.writeFileSync(changelogPath, changelogLines.join(os.EOL));
}

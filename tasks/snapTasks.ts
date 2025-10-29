/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { findTagsByVersion } from './gitTasks';
import minimist from 'minimist';

const execAsync = promisify(exec);

function logWarning(message: string, error?: unknown): void {
    console.log(`##vso[task.logissue type=warning]${message}`);
    if (error instanceof Error && error.stack) {
        console.log(`##[debug]${error.stack}`);
    }
}

/**
 * Calculate the next release (stable) version from the current version.
 * Rounds up the minor version to the next tens version.
 * @param currentVersion The current version in "major.minor" format (e.g., "2.74")
 * @returns The next stable release version (e.g., "2.80")
 */
export function getNextReleaseVersion(currentVersion: string): string {
    const split = currentVersion.split('.');
    const major = parseInt(split[0]);
    const minor = parseInt(split[1]);

    // Round up to the next tens version
    const nextTensMinor = Math.ceil((minor + 1) / 10) * 10;

    return `${major}.${nextTensMinor}`;
}

/**
 * Read and parse version.json
 * @returns The parsed version.json object
 */
function readVersionJson(): { version: string; [key: string]: unknown } {
    const versionFilePath = path.join(path.resolve(__dirname, '..'), 'version.json');
    const file = fs.readFileSync(versionFilePath, 'utf8');
    return JSON.parse(file);
}

/**
 * Write version.json with the given version
 * @param versionJson The version.json object to write
 */
function writeVersionJson(versionJson: { version: string; [key: string]: unknown }): void {
    const versionFilePath = path.join(path.resolve(__dirname, '..'), 'version.json');
    const newJson = JSON.stringify(versionJson, null, 4);
    console.log(`New json: ${newJson}`);
    fs.writeFileSync(versionFilePath, newJson);
}

/**
 * Add a new version section to the changelog
 * @param version The version to add (e.g., "2.75")
 * @param additionalLines Optional additional lines to add after the version header
 */
function addChangelogSection(version: string, additionalLines?: string[]): void {
    console.log('Adding new version header to changelog');

    const changelogPath = path.join(path.resolve(__dirname, '..'), 'CHANGELOG.md');
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    const changelogLines = changelogContent.split(os.EOL);

    // Find all the headers in the changelog (and their line numbers)
    const headerRegex = /^#+\s+.*$/gm;
    const matches = [];
    for (let i = 0; i < changelogLines.length; i++) {
        const line = changelogLines.at(i);
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

gulp.task('incrementVersion', async (): Promise<void> => {
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
});

gulp.task('updateChangelog', async (): Promise<void> => {
    // Add a new changelog section for the new version.
    console.log('Determining version from CHANGELOG');

    const changelogPath = path.join(path.resolve(__dirname, '..'), 'CHANGELOG.md');
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    const changelogLines = changelogContent.split(os.EOL);

    // Find all the headers in the changelog (and their line numbers)
    const [currentHeaderLine, currentVersion] = findNextVersionHeaderLine(changelogLines);
    if (currentHeaderLine === -1) {
        throw new Error('Could not find the current header in the CHANGELOG');
    }

    console.log(`Adding PRs for ${currentVersion} to CHANGELOG`);

    const [previousHeaderLine, previousVersion] = findNextVersionHeaderLine(changelogLines, currentHeaderLine + 1);
    if (previousHeaderLine === -1) {
        throw new Error('Could not find the previous header in the CHANGELOG');
    }

    const presentPrIds = getPrIdsBetweenHeaders(changelogLines, currentHeaderLine, previousHeaderLine);
    console.log(`PRs [#${presentPrIds.join(', #')}] already in the CHANGELOG`);

    const versionTags = await findTagsByVersion(previousVersion!);
    if (versionTags.length === 0) {
        throw new Error(`Could not find any tags for version ${previousVersion}`);
    }

    // The last tag is the most recent one created.
    const versionTag = versionTags.pop();
    console.log(`Using tag ${versionTag} for previous version ${previousVersion}`);

    console.log(`Generating PR list from ${versionTag} to HEAD`);
    const currentPrs = await generatePRList(versionTag!, 'HEAD');

    const newPrs = [];
    for (const pr of currentPrs) {
        const match = prRegex.exec(pr);
        if (!match) {
            continue;
        }

        const prId = match[1];
        if (presentPrIds.includes(prId)) {
            console.log(`PR #${prId} is already present in the CHANGELOG`);
            continue;
        }

        console.log(`Adding new PR to CHANGELOG: ${pr}`);
        newPrs.push(pr);
    }

    if (newPrs.length === 0) {
        console.log('No new PRs to add to the CHANGELOG');
        return;
    }

    console.log(`Writing ${newPrs.length} new PRs to the CHANGELOG`);

    changelogLines.splice(currentHeaderLine + 1, 0, ...newPrs);
    fs.writeFileSync(changelogPath, changelogLines.join(os.EOL));
});

const prRegex = /^\*.+\(PR: \[#(\d+)\]\(/;

function findNextVersionHeaderLine(changelogLines: string[], startLine: number = 0): [number, string] {
    const headerRegex = /^#\s(\d+\.\d+)\.(x|\d+)$/;
    for (let i = startLine; i < changelogLines.length; i++) {
        const line = changelogLines.at(i);
        const match = headerRegex.exec(line!);
        if (match) {
            return [i, match[1]];
        }
    }
    return [-1, ''];
}

function getPrIdsBetweenHeaders(changelogLines: string[], startLine: number, endLine: number): string[] {
    const prs: string[] = [];
    for (let i = startLine; i < endLine; i++) {
        const line = changelogLines.at(i);
        const match = prRegex.exec(line!);
        if (match) {
            prs.push(match[1]);
        }
    }
    return prs;
}

async function generatePRList(startSHA: string, endSHA: string): Promise<string[]> {
    try {
        console.log(`Executing: roslyn-tools pr-finder -s "${startSHA}" -e "${endSHA}" --format o#`);
        let { stdout } = await execAsync(
            `roslyn-tools pr-finder -s "${startSHA}" -e "${endSHA}" --format o#`,
            { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
        );

        stdout = stdout.trim();
        if (stdout.length === 0) {
            return [];
        }

        return stdout.split(os.EOL).filter((pr) => pr.length > 0);
    } catch (error) {
        logWarning(`PR finder failed: ${error instanceof Error ? error.message : error}`, error);
        throw error;
    }
}

/**
 * Update version.json to the next stable release version.
 * This task is used when snapping from prerelease to release.
 * It updates the version to round up to the next tens version (e.g., 2.74 -> 2.80).
 */
gulp.task('updateVersionForStableRelease', async (): Promise<void> => {
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
});

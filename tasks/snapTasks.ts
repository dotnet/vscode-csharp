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

const execAsync = promisify(exec);

function logWarning(message: string, error?: unknown): void {
    console.log(`##vso[task.logissue type=warning]${message}`);
    if (error instanceof Error && error.stack) {
        console.log(`##[debug]${error.stack}`);
    }
}

gulp.task('incrementVersion', async (): Promise<void> => {
    // Get the current version from version.json
    const versionFilePath = path.join(path.resolve(__dirname, '..'), 'version.json');
    const file = fs.readFileSync(versionFilePath, 'utf8');
    const versionJson = JSON.parse(file);

    // Increment the minor version
    const version = versionJson.version as string;
    const split = version.split('.');
    const newVersion = `${split[0]}.${parseInt(split[1]) + 1}`;

    console.log(`Updating ${version} to ${newVersion}`);

    // Write the new version back to version.json
    versionJson.version = newVersion;
    const newJson = JSON.stringify(versionJson, null, 4);
    console.log(`New json: ${newJson}`);

    fs.writeFileSync(versionFilePath, newJson);

    // Add a new changelog section for the new version.
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
    const linesToInsert = ['', `# ${newVersion}.x`];

    changelogLines.splice(lineToInsertAt, 0, ...linesToInsert);
    fs.writeFileSync(changelogPath, changelogLines.join(os.EOL));
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

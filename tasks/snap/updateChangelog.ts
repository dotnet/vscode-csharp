/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { rootPath } from '../projectPaths';
import { findTagsByVersion } from '../gitTasks';
import { runTask } from '../runTask';

const execAsync = promisify(exec);

runTask(updateChangelog);

async function updateChangelog(): Promise<void> {
    // Add a new changelog section for the new version.
    console.log('Determining version from CHANGELOG');

    const changelogPath = path.join(rootPath, 'CHANGELOG.md');
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
}

const prRegex = /^\*.+\(PR: \[#(\d+)\]\(/;

function findNextVersionHeaderLine(changelogLines: string[], startLine: number = 0): [number, string] {
    const headerRegex = /^#\s(\d+\.\d+)\.(x|\d+)$/;
    for (let i = startLine; i < changelogLines.length; i++) {
        const line = changelogLines[i];
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
        const line = changelogLines[i];
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

function logWarning(message: string, error?: unknown): void {
    console.log(`##vso[task.logissue type=warning]${message}`);
    if (error instanceof Error && error.stack) {
        console.log(`##[debug]${error.stack}`);
    }
}

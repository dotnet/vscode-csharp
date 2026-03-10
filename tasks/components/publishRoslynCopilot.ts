/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as process from 'node:process';
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import {
    configureGitUser,
    createCommit,
    pushBranch,
    createPullRequest,
    doesBranchExist,
    findPRByTitle,
} from '../gitTasks';
import { updatePackageDependencies } from '../../src/tools/updatePackageDependencies';
import { runTask } from '../runTask';

type Options = {
    userName?: string;
    email?: string;
};

runTask(publishRoslynCopilot);

async function publishRoslynCopilot() {
    const parsedArgs = minimist<Options>(process.argv.slice(2));

    if (!parsedArgs.stagingDirectory || !fs.existsSync(parsedArgs.stagingDirectory)) {
        throw new Error(`Staging directory not found at ${parsedArgs.stagingDirectory}; skipping package.json update.`);
    }

    // Find the Roslyn zip file in the staging directory (we know it was copied here)
    const files = fs.readdirSync(parsedArgs.stagingDirectory);
    const zipFile = files.find((file) => /Roslyn\.LanguageServer.*\.zip$/i.test(file));

    if (!zipFile) {
        throw new Error(`
            No Roslyn LanguageServer zip file found in ${parsedArgs.stagingDirectory}; skipping package.json update.`);
    }

    const zipPath = path.join(parsedArgs.stagingDirectory, zipFile);
    console.log(`Using zip file: ${zipPath}`);
    const zipName = zipFile;

    // Extract version from file name
    const version = extractVersion(zipName, /Microsoft\.VisualStudio\.Copilot\.Roslyn\.LanguageServer-(.+)\.zip$/i);

    if (!version) {
        throw new Error(`Could not extract version from file name ${zipName}; skipping.`);
    }

    console.log(`Extracted version: ${version}`);

    const safeVersion = version.replace(/[^A-Za-z0-9_.-]/g, '-');
    const branch = `update/roslyn-copilot-${safeVersion}`;

    const pat = process.env['GitHubPAT'];
    if (!pat) {
        throw 'No GitHub PAT found.';
    }

    const owner = 'dotnet';
    const repo = 'vscode-csharp';
    const title = `Update RoslynCopilot url to ${version}`;
    const body = `Automated update of RoslynCopilot url to ${version}`;

    // Bail out if a branch with the same name already exists or PR already exists for the insertion.
    if (await doesBranchExist('origin', branch)) {
        console.log(`##vso[task.logissue type=warning]${branch} already exists in origin. Skip pushing.`);
        return;
    }
    const existingPRUrl = await findPRByTitle(pat, owner, repo, title);
    if (existingPRUrl) {
        console.log(
            `##vso[task.logissue type=warning] Pull request with the same name already exists: ${existingPRUrl}`
        );
        return;
    }

    // Set environment variables for updatePackageDependencies
    process.env['NEW_DEPS_ID'] = 'RoslynCopilot';
    process.env['NEW_DEPS_VERSION'] = version;
    process.env[
        'NEW_DEPS_URLS'
    ] = `https://roslyn.blob.core.windows.net/releases/Microsoft.VisualStudio.Copilot.Roslyn.LanguageServer-${version}.zip`;

    // Update package dependencies using the extracted utility
    await updatePackageDependencies();
    console.log(`Updated RoslynCopilot dependency to version ${version}`);

    // Configure git user if provided
    await configureGitUser(parsedArgs.userName, parsedArgs.email);

    // Create commit with changes
    await createCommit(branch, ['package.json'], `Update RoslynCopilot version to ${version}`);

    // Push branch and create PR
    await pushBranch(branch, pat, owner, repo);
    await createPullRequest(pat, owner, repo, branch, title, body);
}

/**
 * Extract version from file name using a provided regex pattern
 * @param fileName - The file name to extract version from
 * @param pattern - The regex pattern to match and extract version (should have a capture group)
 * @returns The extracted version string or null if not found
 */
function extractVersion(fileName: string, pattern: RegExp): string | null {
    const match = fileName.match(pattern);
    return match && match[1] ? match[1] : null;
}

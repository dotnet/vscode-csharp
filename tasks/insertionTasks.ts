/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as xml2js from 'xml2js';
import { allNugetPackages} from './offlinePackagingTasks';
import {getCommitFromNugetAsync, logWarning, logError, createBranchAndPR } from './gitHelpers';
import * as os from 'os';

const execAsync = promisify(exec);

interface InsertionOptions {
    roslynVersion?: string;
    roslynEndSHA?: string;
    roslynBuildId?: string;
    roslynBuildNumber?: string;
    assetManifestPath?: string;
    roslynRepoPath?: string;
    targetBranch?: string;
    githubPAT?: string;
    dryRun?: boolean;
}

gulp.task('insertion:roslyn', async (): Promise<void> => {
    const options = minimist<InsertionOptions>(process.argv.slice(2));

    console.log('Starting Roslyn insertion process...');

    try {
        // Step 1: Extract Roslyn version from AssetManifest
        if (!options.assetManifestPath) {
            throw new Error('assetManifestPath is required');
        }

        const newVersion = await extractRoslynVersionFromManifest(options.assetManifestPath);
        if (!newVersion) {
            throw new Error('Failed to extract Roslyn version from asset manifest');
        }
        options.roslynVersion = newVersion;
        console.log(`New Roslyn version: ${newVersion}`);

        // Step 2: Get current SHA from package
        const currentSHA = await getCommitFromNugetAsync(allNugetPackages.roslyn);
        if (!currentSHA) {
            throw new Error('Could not determine current Roslyn SHA from package');
        }
        console.log(`Current Roslyn SHA: ${currentSHA}`);

        // Step 3: Check if update needed
        if (!options.roslynEndSHA) {
            throw new Error('roslynEndSHA is required');
        }

        if (currentSHA === options.roslynEndSHA) {
            console.log('No new commits to process - versions are identical');
            return;
        }

        console.log(`Update needed: ${currentSHA}..${options.roslynEndSHA}`);

        // Step 4: Verify Roslyn repo exists
        if (!options.roslynRepoPath) {
            throw new Error('roslynRepoPath is required');
        }
        await verifyRoslynRepo(options.roslynRepoPath);

        // Step 5: Generate PR list
        const prList = await generatePRList(currentSHA, options.roslynEndSHA, options.roslynRepoPath, options);
        console.log('PR List generated:', prList);

        // Check if PR list is empty or contains no meaningful PRs
        if (!prList || prList === '(no PRs with required labels)') {
            console.log('No PRs with required labels found. Skipping insertion.');
            logWarning('No PRs with VSCode label found between the commits. Skipping insertion.');
            return;
        }

        // Step 6: Update files
        await updatePackageJson(options.roslynVersion);
        await updateChangelog(options.roslynVersion, prList, options.roslynBuildNumber, options.roslynBuildId);

        // Step 7: Create branch and PR
        const prTitle = `Bump Roslyn to ${options.roslynVersion} (${options.roslynEndSHA?.substring(0, 8)})`;
        const prBody = `This PR updates Roslyn to version ${options.roslynVersion} (${options.roslynEndSha}).\n\n${prList}`;
        const commitMessage = `Bump Roslyn to ${options.roslynVersion} (${options.roslynEndSha?.substring(0, 8)})`;

        await createBranchAndPR({
            ...options,
            commitSha: options.roslynEndSHA!,
            targetRemoteRepo: 'vscode-csharp',
            baseBranch: options.targetBranch || 'main',
            newBranchName: `insertion/${options.roslynEndSHA}`,
            githubPAT: options.githubPAT!,
            dryRun: options.dryRun,
            userName: options.userName,
            email: options.email
        }, prTitle, commitMessage, prBody);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(`Insertion failed: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            console.log(`##[debug]${error.stack}`);
        }
        throw error;
    }
});

async function extractRoslynVersionFromManifest(manifestPath: string): Promise<string | null> {
    const xmlFile = path.join(manifestPath, 'OfficialBuild.xml');

    if (!fs.existsSync(xmlFile)) {
        logError(`OfficialBuild.xml not found at ${xmlFile}`);
        return null;
    }

    const xmlContent = fs.readFileSync(xmlFile, 'utf8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);

    const packages = result?.Build?.Package || [];
    for (const pkg of packages) {
        const attrs = pkg.$;
        if (attrs?.Id === 'Microsoft.CodeAnalysis.Common') {
            return attrs.Version;
        }
    }

    return null;
}

async function verifyRoslynRepo(roslynRepoPath: string): Promise<void> {
    if (!fs.existsSync(roslynRepoPath)) {
        throw new Error(`Roslyn repository not found at ${roslynRepoPath}`);
    }
    console.log(`Using Roslyn repository at ${roslynRepoPath}`);
}

async function generatePRList(startSHA: string, endSHA: string, roslynRepoPath: string, options: InsertionOptions): Promise<string> {
    console.log(`Generating PR list from ${startSHA} to ${endSHA}...`);

    // Setup auth for roslyn-tools
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const settingsDir = path.join(homeDir!, '.roslyn-tools');
    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
    }

    const authJson = {
        GitHubToken: options.githubPAT || '',
        DevDivAzureDevOpsToken: '',
        DncEngAzureDevOpsToken: ''
    };
    const settingsFile = path.join(settingsDir, 'settings');
    fs.writeFileSync(settingsFile, Buffer.from(JSON.stringify(authJson)).toString('base64'));

    try {
        const { stdout } = await execAsync(
            `cd "${roslynRepoPath}" && roslyn-tools pr-finder -s "${startSHA}" -e "${endSHA}" --format changelog --label VSCode`,
            { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
        );
        return stdout || '(failed to generate PR list, see pipeline for details)';
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logWarning(`PR finder failed, using empty list: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            console.log(`##[debug]${error.stack}`);
        }
        return '(failed to generate PR list, see pipeline for details)';
    }
}

async function updatePackageJson(newVersion: string): Promise<void> {
    console.log(`Updating package.json with Roslyn version ${newVersion}...`);
    const packageJsonPath = 'package.json';
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    if (!packageJson.defaults) {
        throw new Error('Could not find defaults section in package.json');
    }
    packageJson.defaults.roslyn = newVersion;

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

async function updateChangelog(version: string, prList: string, buildNumber?: string, buildId?: string): Promise<void> {
    console.log('Updating CHANGELOG.md...');
    const changelogPath = 'CHANGELOG.md';
    const text = fs.readFileSync(changelogPath, 'utf8');
    const NL = os.EOL;

    // Prepare PR list (filter out 'View Complete Diff' lines)
    const prLines = prList
        ? prList
            .split(/\r?\n/)
            .filter((l) => l.trim() && !l.includes('View Complete Diff'))
            .map((line) => line.trim())
        : [];

    const formattedPRList = prLines.length > 0 ? prLines.map((line) => `  ${line}`).join(NL) : '';

    // Find the first top-level header "# ..."
    const topHeaderRegex = /^(# .*?)(\r?\n|$)/m;
    const headerMatch = topHeaderRegex.exec(text);
    if (!headerMatch) {
        throw new Error('CHANGELOG.md must contain at least one top-level header (#)');
    }

    const headerEndLineIndex = headerMatch.index + headerMatch[0].length;

    // Prepare new Roslyn block
    const prLink = buildNumber && buildId
        ? `[#${buildNumber}](https://dev.azure.com/dnceng/internal/_build/results?buildId=${buildId})`
        : '[#TBD](TBD)';

    let newRoslynBlock = `* Bump Roslyn to ${version} (PR: ${prLink})`;
    const shouldSkipPRList = prList === '(failed to generate PR list, see pipeline for details)';

    if (!shouldSkipPRList && formattedPRList) {
        newRoslynBlock += NL + formattedPRList;
    }
    newRoslynBlock += NL; // Ensure there's always a newline at the end

    // Insert the new block right after the header
    const newText =
        text.slice(0, headerEndLineIndex) +
        NL + NL + // Add two newlines after the header
        newRoslynBlock +
        (text.length > headerEndLineIndex ? NL + text.slice(headerEndLineIndex) : '');

    // Write the updated content back to the file
    fs.writeFileSync(changelogPath, newText, 'utf8');
    console.log('CHANGELOG.md updated successfully');
}

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
import { allNugetPackages } from './offlinePackagingTasks';
import {
    getCommitFromNugetAsync,
    git,
    configureGitUser,
    createCommit,
    pushBranch,
    createPullRequest,
} from './gitTasks';
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
    dryRun: boolean;
}

function logWarning(message: string, error?: unknown): void {
    console.log(`##vso[task.logissue type=warning]${message}`);
    if (error instanceof Error && error.stack) {
        console.log(`##[debug]${error.stack}`);
    }
}

function logError(message: string, error?: unknown): void {
    console.log(`##vso[task.logissue type=error]${message}`);
    if (error instanceof Error && error.stack) {
        console.log(`##[debug]${error.stack}`);
    }
}

gulp.task('insertion:roslyn', async (): Promise<void> => {
    const options = minimist<InsertionOptions>(process.argv.slice(2), {
        boolean: ['dryRun'],
        default: {
            dryRun: false,
        },
    });

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

        // Check if PR list is null or empty (generation failed or no matching PRs)
        if (!prList) {
            console.log('No PRs with required labels found or PR list generation failed. Skipping insertion.');
            logWarning(
                'No PRs with VSCode label found between the commits or PR list generation failed. Skipping insertion.'
            );
            return;
        }

        // Step 6: Update files
        await updatePackageJson(options.roslynVersion);

        // Step 7: Create branch and PR
        const prTitle = `Bump Roslyn to ${options.roslynVersion} (${options.roslynEndSHA?.substring(0, 8)})`;

        // Include build information in the PR description
        let prBody = `This PR updates Roslyn to version ${options.roslynVersion} (${options.roslynEndSHA}).\n\n`;

        // Add build link if build information is available
        if (options.roslynBuildNumber && options.roslynBuildId) {
            prBody += `Build: [#${options.roslynBuildNumber}](https://dev.azure.com/dnceng/internal/_build/results?buildId=${options.roslynBuildId})\n\n`;
        }

        // Add PR list
        prBody += prList;

        const commitMessage = `Bump Roslyn to ${options.roslynVersion} (${options.roslynEndSHA?.substring(0, 8)})`;
        const newBranchName = `insertion/${options.roslynEndSHA}`;

        // Configure git user credentials
        await configureGitUser(options.userName, options.email);

        // Create branch and commit changes
        await createCommit(newBranchName, ['.'], commitMessage);

        let prNumber: number | null = null;

        if (options.dryRun !== true) {
            // Push branch to remote
            await pushBranch(newBranchName, options.githubPAT!, 'deepakrathore33', 'vscode-csharp');

            // Create pull request
            const prUrl = await createPullRequest(
                options.githubPAT!,
                'deepakrathore33',
                'vscode-csharp',
                newBranchName,
                prTitle,
                prBody,
                options.targetBranch || 'main'
            );

            if (prUrl) {
                console.log(`Created pull request: ${prUrl}.`);
                // Extract PR number from URL (format: https://github.com/owner/repo/pull/123)
                const prNumberMatch = prUrl.match(/\/pull\/(\d+)$/);
                prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : null;
            }
        } else {
            console.log('[DRY RUN] Would have pushed branch to remote');
            console.log(`[DRY RUN] Would have created PR with title: "${prTitle}" and body: "${prBody}"`);
        }

        // If PR was created and we're not in dry run mode, update the changelog with the PR number
        if (prNumber && options.dryRun !== true) {
            console.log(`PR #${prNumber} created. Updating changelog with PR link...`);

            // Update changelog with PR number (single call)
            await updateChangelog(options.roslynVersion, prList, prNumber);

            // Create a second commit to include the updated changelog and push to update the PR
            await git(['add', 'CHANGELOG.md']);
            await git(['commit', '-m', `Update changelog with PR #${prNumber}`]);
            await git(['push', 'targetRepo', newBranchName]);

            console.log(`Changelog updated with PR #${prNumber} link.`);
        }
    } catch (error) {
        logError(`Insertion failed: ${error instanceof Error ? error.message : String(error)}`, error);
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

    logError('Microsoft.CodeAnalysis.Common package not found in the asset manifest.');
    return null;
}

async function verifyRoslynRepo(roslynRepoPath: string): Promise<void> {
    if (!fs.existsSync(roslynRepoPath)) {
        throw new Error(`Roslyn repository not found at ${roslynRepoPath}`);
    }
    console.log(`Using Roslyn repository at ${roslynRepoPath}`);
}

async function generatePRList(
    startSHA: string,
    endSHA: string,
    roslynRepoPath: string,
    _options: InsertionOptions
): Promise<string | null> {
    console.log(`Generating PR list from ${startSHA} to ${endSHA}...`);

    try {
        const { stdout } = await execAsync(
            `cd "${roslynRepoPath}" && roslyn-tools pr-finder -s "${startSHA}" -e "${endSHA}" --format changelog --label VSCode`,
            { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
        );
        return stdout && stdout.trim() ? stdout : null;
    } catch (error) {
        logWarning(`PR finder failed: ${error instanceof Error ? error.message : String(error)}`, error);
        return null;
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

async function updateChangelog(version: string, prList: string | null, prNumber?: number): Promise<void> {
    console.log('Updating CHANGELOG.md...');
    const changelogPath = 'CHANGELOG.md';
    const text = fs.readFileSync(changelogPath, 'utf8');
    const NL = os.EOL;

    // Find the first top-level header "# ..."
    const topHeaderRegex = /^(# .*?)(\r?\n|$)/m;
    const headerMatch = topHeaderRegex.exec(text);
    if (!headerMatch) {
        throw new Error('CHANGELOG.md must contain at least one top-level header (#)');
    }

    const headerEndLineIndex = headerMatch.index + headerMatch[0].length;

    // Prepare new Roslyn block
    let newRoslynBlock = `* Bump Roslyn to ${version}`;

    // Add PR number if available
    if (prNumber) {
        newRoslynBlock = `* Bump Roslyn to ${version} (PR: [#${prNumber}](https://github.com/dotnet/vscode-csharp/pull/${prNumber}))`;
    }

    // Add PR list as sub-items if available
    if (prList) {
        const prLines = prList
            .split(/\r?\n/)
            .filter((l) => l.trim() && !l.includes('View Complete Diff'))
            .map((line) => line.trim());

        const formattedPRList = prLines.length > 0 ? prLines.map((line) => `  ${line}`).join(NL) : '';

        if (formattedPRList) {
            newRoslynBlock += NL + formattedPRList;
        }
    }

    // Insert the new block right after the header
    const newText =
        text.slice(0, headerEndLineIndex) +
        newRoslynBlock +
        (text.length > headerEndLineIndex ? NL + text.slice(headerEndLineIndex) : '');

    // Write the updated content back to the file
    fs.writeFileSync(changelogPath, newText, 'utf8');
    console.log('CHANGELOG.md updated successfully');
}

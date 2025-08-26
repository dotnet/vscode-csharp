/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import minimist from 'minimist';

function logWarning(message: string): void {
    console.log(`##vso[task.logissue type=warning]${message}`);
}

function logError(message: string): void {
    console.log(`##vso[task.logissue type=error]${message}`);
}

import minimist from 'minimist';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import * as AdmZip from 'adm-zip';

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
    console.log(`Options: ${JSON.stringify(options, null, 2)}`);
    
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
        const currentSHA = await getCurrentRoslynSHA();
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
        
        // Step 6: Update files
        await updatePackageJson(options.roslynVersion);
        await updateChangelog(options.roslynVersion, prList, options.roslynBuildNumber, options.roslynBuildId);
        
        // Step 6: Create branch and PR
        await createBranchAndPR(options.roslynVersion, options.roslynEndSHA, options);
        
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
    
    // Navigate the XML structure to find Microsoft.CodeAnalysis package
    const packages = result?.Build?.Package || [];
    for (const pkg of packages) {
        const attrs = pkg.$;
        if (attrs?.Id === 'Microsoft.CodeAnalysis.Common') {
            return attrs.Version;
        }
    }
    
    return null;
}

async function getCurrentRoslynSHA(): Promise<string | null> {
    const packageJsonContent = fs.readFileSync('package.json', 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    const currentVersion = packageJson.defaults?.roslyn;
    
    if (!currentVersion) {
        console.log('No roslyn version in package.json, this is first run');
        return null;
    }
    
    console.log(`Current Roslyn version: ${currentVersion}`);
    
    try {
        const packageName = 'microsoft.codeanalysis.common';
        // Package names are always lower case in the .nuget folder.
        const packageDir = path.join('out', '.nuget', packageName.toLowerCase(), currentVersion);
        const nuspecFiles = fs.readdirSync(packageDir).filter((file) => file.endsWith('.nuspec'));

        if (nuspecFiles.length === 0) {
            logError(`No .nuspec file found in ${packageDir}`);
            return null;
        }

        if (nuspecFiles.length > 1) {
            logError(`Multiple .nuspec files found in ${packageDir}`);
            return null;
        }

        const nuspecFilePath = path.join(packageDir, nuspecFiles[0]);
        const nuspecFile = fs.readFileSync(nuspecFilePath).toString();
        const results = /commit="(.*?)"/.exec(nuspecFile);
        if (results == null || results.length === 0) {
            logError('Failed to find commit number from nuspec file');
            return null;
        }

        if (results.length !== 2) {
            logError('Unexpected regex match result from nuspec file.');
            return null;
        }

        const commitNumber = results[1];
        console.log(`Found commit SHA: ${commitNumber}`);
        return commitNumber;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(`Error getting current SHA: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            console.log(`##[debug]${error.stack}`);
        }
        return null;
    }
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
        return stdout || '(no PRs with required labels)';
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logWarning(`PR finder failed, using empty list: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            console.log(`##[debug]${error.stack}`);
        }
        return '(no PRs with required labels)';
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
    let changelogContent = fs.readFileSync(changelogPath, 'utf8');
    
    // Format PR list with proper indentation
    const formattedPRList = prList.split('\n').map(line => `  ${line}`).join(os.EOL);
    
    // Find and update the Roslyn bump line
    const lines = changelogContent.split(/\r?\n/);
    const newLines: string[] = [];
    let skipNext = false;
    
    for (let i = 0; i < lines.length; i++) {
        if (skipNext && lines[i].startsWith('  *')) {
            continue;
        }
        skipNext = false;
        
        if (lines[i].match(/^\* Bump Roslyn to/)) {
            const prLink = buildNumber && buildId 
                ? `[${buildNumber}](https://dev.azure.com/dnceng/internal/_build/results?buildId=${buildId})`
                : '[#TBD](TBD)';
            newLines.push(`* Bump Roslyn to ${version} (PR: ${prLink})`);
            if (prList !== '(no PRs with required labels)') {
                newLines.push(formattedPRList);
            }
            skipNext = true;
        } else {
            newLines.push(lines[i]);
        }
    }
    
    fs.writeFileSync(changelogPath, newLines.join('\n'));
}

async function createBranchAndPR(version: string, endSHA: string, options: InsertionOptions): Promise<void> {
    try {
        console.log('Creating and pushing branch...');
        
        // Configure git user
        await git(['config', '--local', 'user.name', 'Azure Pipelines']);
        await git(['config', '--local', 'user.email', 'azuredevops@microsoft.com']);
        
        // Check for changes
        const changedFiles = await git(['diff', '--name-only', 'HEAD']);
        if (!changedFiles) {
            console.log('No files changed, skipping branch creation');
            return;
        }
        
        console.log(`Changed files: ${changedFiles}`);
        
        // Create and checkout new branch
        const shortSHA = endSHA.substring(0, 8);
        const branchName = `insertion/${shortSHA}`;
        await git(['checkout', '-b', branchName]);
        
        // Stage and commit changes
        await git(['add', 'package.json', 'CHANGELOG.md']);
        await git(['commit', '-m', `Bump Roslyn to ${version} (${shortSHA})`]);
        
        // Configure remote with PAT for authentication
        const pat = options.githubPAT;
        if (!pat) {
            throw new Error('GitHub PAT is required to push changes');
        }
        
        const remoteRepoAlias = 'targetRepo';
        await git(
            [
                'remote',
                'add',
                remoteRepoAlias,
                `https://${pat}@github.com/dotnet/vscode-csharp.git`,
            ],
            false // Don't log the command to avoid exposing the PAT
        );
        
        // Check if branch already exists
        const lsRemote = await git(['ls-remote', '--heads', remoteRepoAlias, branchName]);
        if (lsRemote.trim() !== '') {
            console.log(`##vso[task.logissue type=warning]${branchName} already exists. Skipping push.`);
            return;
        }
        
        // Push the branch
        await git(['push', '-u', remoteRepoAlias, branchName]);
        
        // Create PR if not in dry run mode
        if (options.dryRun) {
            console.log('Dry run: Would create PR for branch', branchName);
            return;
        }
        
        console.log('Creating pull request...');
        const octokit = new Octokit({ auth: pat });
        const title = `Bump Roslyn to ${version} (${shortSHA})`;
        
        // Check if PR already exists
        const listPullRequest = await octokit.rest.pulls.list({
            owner: 'dotnet',
            repo: 'vscode-csharp',
            head: `dotnet:${branchName}`,
            state: 'open'
        });
        
        if (listPullRequest.data.length > 0) {
            console.log(`Pull request already exists: ${listPullRequest.data[0].html_url}`);
            return;
        }
        
        // Create the PR
        const pr = await octokit.rest.pulls.create({
            owner: 'dotnet',
            repo: 'vscode-csharp',
            title: title,
            head: branchName,
            base: options.targetBranch || 'main',
            body: `This is an automated PR to update the Roslyn version to ${version} (${shortSHA})`,
            maintainer_can_modify: true
        });
        
        console.log(`Created pull request: ${pr.data.html_url}`);
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(`Failed to create branch/PR: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            console.log(`##[debug]${error.stack}`);
        }
        throw error;
    }
}

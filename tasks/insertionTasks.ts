/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import * as xml2js from 'xml2js';
import * as AdmZip from 'adm-zip';

const execAsync = promisify(exec);

interface InsertionOptions {
    roslynVersion?: string;
    roslynStartSHA?: string;
    roslynEndSHA?: string;
    roslynBuildId?: string;
    roslynBuildNumber?: string;
    assetManifestPath?: string;
    createPullRequest?: boolean;
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
        options.roslynStartSHA = currentSHA || '0000000000000000000000000000000000000000';
        console.log(`Current Roslyn SHA: ${options.roslynStartSHA}`);
        
        // Step 3: Check if update needed
        if (!options.roslynEndSHA) {
            throw new Error('roslynEndSHA is required');
        }
        
        if (options.roslynStartSHA === options.roslynEndSHA) {
            console.log('No new commits to process - versions are identical');
            return;
        }
        
        console.log(`Update needed: ${options.roslynStartSHA}..${options.roslynEndSHA}`);
        
        // Step 4: Clone Roslyn repo and generate PR list
        await cloneRoslynRepo();
        const prList = await generatePRList(options.roslynStartSHA, options.roslynEndSHA);
        console.log('PR List generated:', prList);
        
        // Step 5: Update files
        await updatePackageJson(options.roslynVersion);
        await updateChangelog(options.roslynVersion, prList, options.roslynBuildNumber, options.roslynBuildId);
        
        // Step 6: Create branch and PR if not dry run
        if (!options.dryRun) {
            const branchName = await createBranch(options.roslynEndSHA, options.roslynVersion);
            console.log(`Branch created: ${branchName}`);
            
            if (options.createPullRequest) {
                await createPullRequest(branchName, options);
                console.log('Pull request created successfully');
            }
        } else {
            console.log('Dry run mode - skipping branch and PR creation');
        }
        
    } catch (error) {
        console.error('Insertion failed:', error);
        throw error;
    } finally {
        // Cleanup
        if (fs.existsSync('roslyn')) {
            await execAsync('rm -rf roslyn');
        }
    }
});

async function extractRoslynVersionFromManifest(manifestPath: string): Promise<string | null> {
    const xmlFile = path.join(manifestPath, 'OfficialBuild.xml');
    
    if (!fs.existsSync(xmlFile)) {
        console.error(`OfficialBuild.xml not found at ${xmlFile}`);
        return null;
    }
    
    const xmlContent = fs.readFileSync(xmlFile, 'utf8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);
    
    // Navigate the XML structure to find Microsoft.CodeAnalysis package
    const packages = result?.Build?.Package || [];
    for (const pkg of packages) {
        const attrs = pkg.$;
        if (attrs?.Id === 'Microsoft.CodeAnalysis' || attrs?.Id === 'Microsoft.CodeAnalysis.Common') {
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
    
    // Download and extract commit SHA from NuGet package
    const packageName = 'microsoft.codeanalysis.common';
    const feed = 'https://pkgs.dev.azure.com/dnceng/public/_packaging/dotnet-tools/nuget/v3/flat2';
    const packageUrl = `${feed}/${packageName}/${currentVersion}/${packageName}.${currentVersion}.nupkg`;
    
    try {
        const response = await fetch(packageUrl);
        if (!response.ok) {
            console.error(`Failed to download package: ${response.statusText}`);
            return null;
        }
        
        const buffer = await response.buffer();
        const tempFile = path.join(process.cwd(), 'temp-package.nupkg');
        fs.writeFileSync(tempFile, buffer);
        
        const zip = new AdmZip(tempFile);
        const entries = zip.getEntries();
        
        for (const entry of entries) {
            if (entry.entryName.endsWith('.nuspec')) {
                const nuspecContent = zip.readAsText(entry);
                const shaMatch = nuspecContent.match(/repository[^>]*commit="([a-f0-9]{40})"/);
                fs.unlinkSync(tempFile);
                return shaMatch ? shaMatch[1] : null;
            }
        }
        
        fs.unlinkSync(tempFile);
    } catch (error) {
        console.error('Error getting current SHA:', error);
    }
    
    return null;
}

async function cloneRoslynRepo(): Promise<void> {
    console.log('Cloning Roslyn repository...');
    await execAsync('git clone --no-tags --filter=blob:none --depth=500 https://github.com/dotnet/roslyn.git roslyn');
}

async function generatePRList(startSHA: string, endSHA: string): Promise<string> {
    console.log(`Generating PR list from ${startSHA} to ${endSHA}...`);
    
    // Setup auth for roslyn-tools
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const settingsDir = path.join(homeDir!, '.roslyn-tools');
    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
    }
    
    const authJson = {
        GitHubToken: process.env.GITHUB_TOKEN || '',
        DevDivAzureDevOpsToken: '',
        DncEngAzureDevOpsToken: ''
    };
    const settingsFile = path.join(settingsDir, 'settings');
    fs.writeFileSync(settingsFile, Buffer.from(JSON.stringify(authJson)).toString('base64'));
    
    try {
        const { stdout } = await execAsync(
            `cd roslyn && roslyn-tools pr-finder -s "${startSHA}" -e "${endSHA}" --format changelog --label VSCode`,
            { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
        );
        return stdout || '(no PRs with required labels)';
    } catch (error) {
        console.warn('PR finder failed, using empty list:', error);
        return '(no PRs with required labels)';
    }
}

async function updatePackageJson(newVersion: string): Promise<void> {
    console.log(`Updating package.json with Roslyn version ${newVersion}...`);
    const packageJsonPath = 'package.json';
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (!packageJson.defaults) {
        packageJson.defaults = {};
    }
    packageJson.defaults.roslyn = newVersion;
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

async function updateChangelog(version: string, prList: string, buildNumber?: string, buildId?: string): Promise<void> {
    console.log('Updating CHANGELOG.md...');
    const changelogPath = 'CHANGELOG.md';
    let changelogContent = fs.readFileSync(changelogPath, 'utf8');
    
    // Format PR list with proper indentation
    const formattedPRList = prList.split('\n').map(line => `  ${line}`).join('\n');
    
    // Find and update the Roslyn bump line
    const lines = changelogContent.split('\n');
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

async function createBranch(endSHA: string, version: string): Promise<string> {
    console.log('Creating and pushing branch...');
    
    await execAsync('git config user.name "Azure Pipelines"');
    await execAsync('git config user.email "azuredevops@microsoft.com"');
    
    const shortSHA = endSHA.substring(0, 8);
    const branchName = `roslyn-bump/${shortSHA}`;
    
    await execAsync(`git checkout -b ${branchName}`);
    await execAsync('git add package.json CHANGELOG.md');
    await execAsync(`git commit -m "Bump Roslyn to ${version}"`);
    await execAsync(`git push origin ${branchName}`);
    
    return branchName;
}

async function createPullRequest(branchName: string, options: InsertionOptions): Promise<void> {
    console.log('Creating pull request...');
    
    if (!options.githubPAT) {
        console.warn('No GitHub PAT provided, skipping PR creation');
        return;
    }
    
    const octokit = new Octokit({ auth: options.githubPAT });
    
    const prTitle = `Bump Roslyn to ${options.roslynVersion}`;
    const prBody = `Automated Roslyn version bump.

**Version:** \`${options.roslynVersion}\`
**Commit Range:** \`${options.roslynStartSHA}...${options.roslynEndSHA}\`
**Azure DevOps Build:** [${options.roslynBuildNumber}](https://dev.azure.com/dnceng/internal/_build/results?buildId=${options.roslynBuildId})

See CHANGELOG.md for included PRs.`;
    
    try {
        const { data } = await octokit.pulls.create({
            owner: 'dotnet',
            repo: 'vscode-csharp',
            title: prTitle,
            body: prBody,
            head: branchName,
            base: options.targetBranch || 'main'
        });
        
        console.log(`Pull request created: ${data.html_url}`);
    } catch (error) {
        console.error('Failed to create PR:', error);
        throw error;
    }
}

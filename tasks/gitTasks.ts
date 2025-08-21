/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Octokit } from '@octokit/rest';
import { NugetPackageInfo, platformSpecificPackages } from './offlinePackagingTasks';
import { PlatformInformation } from '../src/shared/platform';
import { EOL } from 'os';

export interface GitOptions {
    commitSha: string;
    targetRemoteRepo: string;
    baseBranch: string;
}

export interface PullRequestOptions extends GitOptions {
    githubPAT: string;
    dryRun: boolean;
    newBranchName: string;
    userName?: string;
    email?: string;
}

export function logError(message: string): void {
    console.log(`##vso[task.logissue type=error]${message}`);
}

/**
 * Execute a git command with optional logging
 */
export async function git(args: string[], printCommand: boolean = true): Promise<string> {
    if (printCommand) {
        console.log(`git ${args.join(' ')}`);
    }

    const result = spawnSync('git', args);
    if (result.status != 0) {
        const err = result.stderr ? result.stderr.toString() : '';
        if (printCommand) {
            console.error(`Failed to execute git ${args.join(' ')}.`);
        }
        throw new Error(err || `git ${args.join(' ')} failed with code ${result.status}`);
    }

    const stdout = result.stdout ? result.stdout.toString() : '';
    if (printCommand) {
        console.log(stdout);
    }
    return stdout;
}

/**
 * Configure git user credentials if provided
 */
export async function configureGitUser(userName?: string, email?: string): Promise<void> {
    if (userName) {
        await git(['config', '--local', 'user.name', userName]);
    }
    if (email) {
        await git(['config', '--local', 'user.email', email]);
    }
}

/**
 * Create a new branch, add files, and commit changes
 */
export async function createCommit(branch: string, files: string[], commitMessage: string): Promise<void> {
    await git(['checkout', '-b', branch]);
    await git(['add', ...files]);
    await git(['commit', '-m', commitMessage]);
}

/**
 * Check if a branch exists on the remote repository
 */
export async function doesBranchExist(remoteAlias: string, branch: string): Promise<boolean> {
    const lsRemote = await git(['ls-remote', remoteAlias, 'refs/heads/' + branch]);
    return lsRemote.trim() !== '';
}

/**
 * Push branch to remote repository with authentication
 */
export async function pushBranch(branch: string, pat: string, owner: string, repo: string): Promise<void> {
    const remoteRepoAlias = 'targetRepo';
    const authRemote = `https://x-access-token:${pat}@github.com/${owner}/${repo}.git`;

    // Add authenticated remote
    await git(
        ['remote', 'add', remoteRepoAlias, authRemote],
        false // Don't print PAT to console
    );

    await git(['fetch', remoteRepoAlias]);

    // Check if branch already exists
    if (await doesBranchExist(remoteRepoAlias, branch)) {
        console.log(`##vso[task.logissue type=error]${branch} already exists in ${owner}/${repo}. Skip pushing.`);
        return;
    }

    await git(['push', '-u', remoteRepoAlias, branch]);
}

/**
 * Find an existing pull request with the given title
 * @returns The PR URL if found, null otherwise
 */
export async function findPRByTitle(pat: string, owner: string, repo: string, title: string): Promise<string | null> {
    try {
        const octokit = new Octokit({ auth: pat });

        const listPullRequest = await octokit.rest.pulls.list({
            owner,
            repo,
        });

        if (listPullRequest.status != 200) {
            throw `Failed get response from GitHub, http status code: ${listPullRequest.status}`;
        }

        const existingPR = listPullRequest.data.find((pr) => pr.title === title);
        return existingPR ? existingPR.html_url : null;
    } catch (e) {
        console.warn('Failed to find PR by title:', e);
        return null; // Assume PR doesn't exist if we can't check
    }
}

/**
 * Create a GitHub pull request
 */
export async function createPullRequest(
    pat: string,
    owner: string,
    repo: string,
    branch: string,
    title: string,
    body: string,
    baseBranch: string = 'main'
): Promise<string | null> {
    try {
        // Check if PR with same title already exists
        const existingPRUrl = await findPRByTitle(pat, owner, repo, title);
        if (existingPRUrl) {
            console.log(`Pull request with the same name already exists: ${existingPRUrl}`);
            return existingPRUrl;
        }

        const octokit = new Octokit({ auth: pat });
        console.log(`Creating PR against ${owner}/${repo}...`);
        const pullRequest = await octokit.rest.pulls.create({
            owner,
            repo,
            title,
            head: branch,
            base: baseBranch,
            body,
        });

        console.log(`Created pull request: ${pullRequest.data.html_url}`);
        return pullRequest.data.html_url;
    } catch (e) {
        console.warn('Failed to create PR via Octokit:', e);
        return null;
    }
}

async function getPackageVersionFromGitHub(packageName: string, releaseCommit: string, githubPAT: string) {
    // Fetch package.json from dotnet/vscode-csharp GitHub repo at the specific commit
    const packageJsonUrl = `https://raw.githubusercontent.com/dotnet/vscode-csharp/${releaseCommit}/package.json`;

    console.log(`Fetching package.json from ${packageJsonUrl}`);

    let packageJson: { defaults?: { [key: string]: string } };
    try {
        const response = await fetch(packageJsonUrl, {
            headers: {
                Authorization: `token ${githubPAT}`,
                Accept: 'application/vnd.github.v3.raw',
            },
        });
        if (!response.ok) {
            logError(`Failed to fetch package.json from ${packageJsonUrl}: ${response.status} ${response.statusText}`);
            return null;
        }
        const packageJsonString = await response.text();
        packageJson = JSON.parse(packageJsonString);
    } catch (error) {
        logError(`Error fetching package.json from GitHub: ${error}`);
        return null;
    }

    const packageVersion = packageJson.defaults?.[packageName];
    if (!packageVersion) {
        logError(`Can't find ${packageName} version in package.json from commit ${releaseCommit}`);
        return null;
    }

    return packageVersion;
}

async function getPackageVersionFromRepo(packageName: string): Promise<string | null> {
    console.log(`Fetching package.json from './package.json'`);

    let packageJson: { defaults?: { [key: string]: string } };
    try {
        const packageJsonString = fs.readFileSync('./package.json').toString();
        packageJson = JSON.parse(packageJsonString);
    } catch (error) {
        logError(`Error reading package.json: ${error}`);
        return null;
    }

    const packageVersion = packageJson.defaults?.[packageName];
    if (!packageVersion) {
        logError(`Can't find ${packageName} version in package.json`);
        return null;
    }
    return packageVersion;
}

export async function getCommitFromNugetAsync(
    packageInfo: NugetPackageInfo,
    releaseCommit?: string | undefined,
    githubPAT?: string | undefined
): Promise<string | null> {
    const packageVersion =
        releaseCommit && githubPAT
            ? await getPackageVersionFromGitHub(packageInfo.packageJsonName, releaseCommit, githubPAT)
            : await getPackageVersionFromRepo(packageInfo.packageJsonName);
    if (!packageVersion) {
        return null;
    }

    const platform = await PlatformInformation.GetCurrent();
    const vsixPlatformInfo = platformSpecificPackages.find(
        (p) => p.platformInfo.platform === platform.platform && p.platformInfo.architecture === platform.architecture
    )!;

    const packageName = packageInfo.getPackageName(vsixPlatformInfo);
    console.log(`${packageName} version is ${packageVersion}`);

    // Nuget package should exist under out/.nuget/ since we have run the install dependencies task.
    // Package names are always lower case in the .nuget folder.
    const packageDir = path.join('out', '.nuget', packageName.toLowerCase(), packageVersion);
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
    console.log(`commitNumber is ${commitNumber}`);
    return commitNumber;
}

/**
 * Find all tags that match the given version pattern
 * @param version The `Major.Minor` version pattern to match
 * @returns A sorted list of matching tags from oldest to newest
 */
export async function findTagsByVersion(version: string): Promise<string[]> {
    const tagList = await git(['tag', '--list', `v${version}*`, '--sort=creatordate'], false);
    return tagList
        .split(EOL)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
}

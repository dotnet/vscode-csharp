/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Octokit } from '@octokit/rest';
import { NugetPackageInfo } from './offlinePackagingTasks';
import { PlatformInformation } from '../src/shared/platform';
import { platformSpecificPackages } from './offlinePackagingTasks';

export interface GitOptions {
    userName?: string;
    email?: string;
    commitSha: string;
    targetRemoteRepo: string;
    baseBranch: string;
}

export interface BranchAndPROptions extends GitOptions {
    githubPAT: string;
    dryRun?: boolean;
    branchPrefix?: string; // optional prefix for branch names (defaults to 'localization')
}

// Logging utilities
export function logWarning(message: string): void {
    console.log(`##vso[task.logissue type=warning]${message}`);
}

export function logError(message: string): void {
    console.log(`##vso[task.logissue type=error]${message}`);
}

export async function git(args: string[], printCommand = true): Promise<string> {
    if (printCommand) {
        console.log(`git ${args.join(' ')}`);
    }

    const git = spawnSync('git', args);
    if (git.status !== 0) {
        const err = git.stderr.toString();
        if (printCommand) {
            console.log(`Failed to execute git ${args.join(' ')}.`);
        }
        throw err;
    }

    const stdout = git.stdout.toString();
    if (printCommand) {
        console.log(stdout);
    }
    return stdout;
}

export async function getCommitFromNugetAsync(packageInfo: NugetPackageInfo): Promise<string | null> {
    try {
        const packageJsonString = fs.readFileSync('./package.json').toString();
        const packageJson = JSON.parse(packageJsonString);
        const packageVersion = packageJson['defaults'][packageInfo.packageJsonName];
        if (!packageVersion) {
            logError(`Can't find ${packageInfo.packageJsonName} version in package.json`);
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
    } catch (error) {
        logError(`Error getting commit from NuGet package: ${error}`);
        if (error instanceof Error && error.stack) {
            console.log(`##[debug]${error.stack}`);
        }
        throw error;
    }
}

export async function createBranchAndPR(
    options: BranchAndPROptions,
    title: string,
    body?: string
): Promise<void> {
    const { githubPAT, targetRemoteRepo, baseBranch, dryRun } = options;
    const remoteRepoAlias = 'target';
    const branchPrefix = options.branchPrefix || 'localization';
    const newBranchName = `${branchPrefix}/${options.commitSha}`;

    // Configure git user
    if (options.userName && options.email) {
        await git(['config', 'user.name', options.userName]);
        await git(['config', 'user.email', options.email]);
    }

    // Create and checkout new branch
    await git(['checkout', '-b', newBranchName]);

    // Add and commit changes
    await git(['add', '.']);
    await git(['commit', '-m', title]);

    // Add remote and push
    await git(
        [
            'remote',
            'add',
            remoteRepoAlias,
            `https://${options.userName}:${githubPAT}@github.com/dotnet/${targetRemoteRepo}.git`,
        ],
        false // Don't print command with PAT
    );

    await git(['fetch', remoteRepoAlias]);

    // Check if branch already exists on remote (refs/heads/<branch>)
    const lsRemote = await git(['ls-remote', remoteRepoAlias, 'refs/heads/' + newBranchName]);
    if (lsRemote.trim() !== '') {
        console.log(`##vso[task.logissue type=error]${newBranchName} already exists in ${targetRemoteRepo}. Skip pushing.`);
        return;
    }

    if (!dryRun) {
        // Push the newly created branch to the target remote
        await git(['push', '-u', remoteRepoAlias, newBranchName]);
    } else {
        console.log('[DRY RUN] Would have pushed branch to remote');
    }

    const octokit = new Octokit({ auth: githubPAT });

    // Check for existing PRs with same title
    const listPullRequest = await octokit.rest.pulls.list({
        owner: 'dotnet',
        repo: targetRemoteRepo,
    });

    if (listPullRequest.status !== 200) {
        throw `Failed to get response from GitHub, http status code: ${listPullRequest.status}`;
    }

    if (listPullRequest.data.some(pr => pr.title === title)) {
        console.log('Pull request with the same name already exists. Skip creation.');
        return;
    }

    if (!dryRun) {
        const pullRequest = await octokit.rest.pulls.create({
            body: body || title,
            owner: 'dotnet',
            repo: targetRemoteRepo,
            title: title,
            head: newBranchName,
            base: baseBranch,
        });
        console.log(`Created pull request: ${pullRequest.data.html_url}.`);
    } else {
        console.log(`[DRY RUN] Would have created PR with title: ${title}`);
    }
}

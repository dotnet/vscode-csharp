/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import minimist from 'minimist';
import { Octokit } from '@octokit/rest';
import { allNugetPackages } from './offlinePackagingTasks';
import { getCommitFromNugetAsync } from './gitHelpers';

interface CreateTagsOptions {
    releaseVersion: string;
    releaseCommit: string;
    // Even it is specified as boolean, it would still be parsed as string in compiled js.
    dryRun: string;
    githubPAT: string | null;
    prerelease: string | null;
}

gulp.task('createTags:roslyn', async (): Promise<void> => {
    const options = minimist<CreateTagsOptions>(process.argv.slice(2));

    return createTagsAsync(
        options,
        'dotnet',
        'roslyn',
        async () => getCommitFromNugetAsync(allNugetPackages.roslyn),
        (releaseVersion: string, isPrerelease: boolean): [string, string] => {
            const prereleaseText = isPrerelease ? '-prerelease' : '';
            return [
                `VSCode-CSharp-${releaseVersion}${prereleaseText}`,
                `${releaseVersion} VSCode C# extension ${prereleaseText}`,
            ];
        }
    );
});

gulp.task('createTags:razor', async (): Promise<void> => {
    const options = minimist<CreateTagsOptions>(process.argv.slice(2));

    return createTagsAsync(
        options,
        'dotnet',
        'razor',
        async () => getCommitFromNugetAsync(allNugetPackages.razor),
        (releaseVersion: string, isPrerelease: boolean): [string, string] => {
            const prereleaseText = isPrerelease ? '-prerelease' : '';
            return [
                `VSCode-CSharp-${releaseVersion}${prereleaseText}`,
                `${releaseVersion} VSCode C# extension ${prereleaseText}`,
            ];
        }
    );
});

gulp.task('createTags:vscode-csharp', async (): Promise<void> => {
    const options = minimist<CreateTagsOptions>(process.argv.slice(2));

    return createTagsAsync(
        options,
        'dotnet',
        'vscode-csharp',
        async () => options.releaseCommit,
        (releaseVersion: string, isPrerelease: boolean): [string, string] => {
            const prereleaseText = isPrerelease ? '-prerelease' : '';
            return [`v${releaseVersion}${prereleaseText}`, releaseVersion];
        }
    );
});

gulp.task('createTags', gulp.series('createTags:roslyn', 'createTags:razor', 'createTags:vscode-csharp'));

async function createTagsAsync(
    options: CreateTagsOptions,
    owner: string,
    repo: string,
    getCommit: () => Promise<string | null>,
    getTagAndMessage: (releaseVersion: string, isPrerelease: boolean) => [string, string]
): Promise<void> {
    console.log(`releaseVersion: ${options.releaseVersion}`);
    console.log(`releaseCommit: ${options.releaseCommit}`);
    const dryRun = getFlag('dryRun', options);
    console.log(`dry run: ${dryRun}`);

    const commit = await getCommit();
    if (!commit) {
        logError('Failed to find commit.');
        return;
    }

    const prerelease = getFlag('prerelease', options);
    console.log(`prerelease: ${prerelease}`);

    const [tag, message] = getTagAndMessage(options.releaseVersion, prerelease);
    console.log(`tag: ${tag}`);
    console.log(`message: ${message}`);

    // The compiled option value in js type is 'any' type.
    if (dryRun) {
        console.log('Tagging is skipped in dry run mode.');
        return;
    } else {
        const githubPAT = getGitHubPAT(options);
        const tagCreated = await tagRepoAsync(owner, repo, commit, tag, message, githubPAT);

        if (!tagCreated) {
            logError(`Failed to tag '${owner}/${repo}'`);
            return;
        }

        console.log(`tag created in '${owner}/${repo}'`);
    }
}

async function tagRepoAsync(
    owner: string,
    repo: string,
    commit: string,
    releaseTag: string,
    tagMessage: string,
    githubPAT: string
): Promise<boolean> {
    console.log(`Start to tag ${owner}/${repo}. Commit: ${commit}, tag: ${releaseTag}, message: ${tagMessage}`);
    const octokit = new Octokit({ auth: githubPAT });
    await octokit.auth();
    const createTagResponse = await octokit.request(`POST /repos/${owner}/${repo}/git/tags`, {
        owner: owner,
        repo: repo,
        tag: releaseTag,
        message: tagMessage,
        object: commit,
        type: 'commit',
    });

    if (createTagResponse.status !== 201) {
        logError(`Failed to create tag for ${commit} in ${owner}/${repo}.`);
        return false;
    }
    try {
        const refCreationResponse = await octokit.request(`Post /repos/${owner}/${repo}/git/refs`, {
            owner: owner,
            repo: repo,
            ref: `refs/tags/${releaseTag}`,
            sha: commit,
        });

        if (refCreationResponse.status !== 201) {
            logError(`Failed to create reference for ${commit} in ${owner}/${repo}.`);
            return false;
        }
    } catch (err: any) {
        if (err.status === 422 && err.message && err.message.includes('Reference already exists')) {
            logWarning(`Reference for tag '${releaseTag}' already exists in ${owner}/${repo}.`);
            return true;
        } else {
            logError(`Failed to create reference for ${commit} in ${owner}/${repo}: ${err}`);
            return false;
        }
    }

    console.log(`Tag is created.`);
    return true;
}

// --- Helper functions ---

function getGitHubPAT(options: { githubPAT?: string | null }): string {
    const pat = options.githubPAT ?? process.env['GitHubPAT'];
    if (!pat) {
        throw 'No GitHub Pat found. Specify with --githubPAT or set GitHubPAT environment variable.';
    }
    return pat;
}

function getFlag<T extends CreateTagsOptions>(option: keyof T, options: T): boolean {
    const value = options[option];
    if (!value) {
        logError(`Missing required argument: --${option.toString()}`);
    }
    if (typeof value === 'string') {
        return value.toLocaleLowerCase() === 'true';
    } else {
        throw new Error(`Expected boolean value for --${option.toString()}, but got ${typeof value}`);
    }
}

function logWarning(message: string): void {
    console.log(`##vso[task.logissue type=warning]${message}`);
}

function logError(message: string): void {
    console.log(`##vso[task.logissue type=error]${message}`);
}

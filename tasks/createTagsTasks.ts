/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as fs from 'fs';
import minimist from 'minimist';
import { Octokit } from '@octokit/rest';
import { allNugetPackages, NugetPackageInfo, platformSpecificPackages } from './offlinePackagingTasks';
import { PlatformInformation } from '../src/shared/platform';
import path from 'path';

interface Options {
    releaseVersion: string;
    releaseCommit: string;
    // Even it is specified as boolean, it would still be parsed as string in compiled js.
    dryRun: string;
    githubPAT: string | null;
}

gulp.task('createTags:roslyn', async (): Promise<void> => {
    const options = minimist<Options>(process.argv.slice(2));

    return createTagsAsync(
        options,
        'dotnet',
        'roslyn',
        async () => getCommitFromNugetAsync(allNugetPackages.roslyn),
        (releaseVersion: string): [string, string] => [
            `VSCode-CSharp-${releaseVersion}`,
            `${releaseVersion} VSCode C# extension release`,
        ]
    );
});

gulp.task('createTags:razor', async (): Promise<void> => {
    const options = minimist<Options>(process.argv.slice(2));

    return createTagsAsync(
        options,
        'dotnet',
        'razor',
        async () => getCommitFromNugetAsync(allNugetPackages.razor),
        (releaseVersion: string): [string, string] => [
            `VSCode-CSharp-${releaseVersion}`,
            `${releaseVersion} VSCode C# extension release`,
        ]
    );
});

gulp.task('createTags:vscode-csharp', async (): Promise<void> => {
    const options = minimist<Options>(process.argv.slice(2));

    return createTagsAsync(
        options,
        'dotnet',
        'vscode-csharp',
        async () => options.releaseCommit,
        (releaseVersion: string): [string, string] => [`v${releaseVersion}`, releaseVersion]
    );
});

gulp.task('createTags', gulp.series('createTags:roslyn', 'createTags:razor', 'createTags:vscode-csharp'));

async function createTagsAsync(
    options: Options,
    owner: string,
    repo: string,
    getCommit: () => Promise<string | null>,
    getTagAndMessage: (releaseVersion: string) => [string, string]
): Promise<void> {
    console.log(`releaseVersion: ${options.releaseVersion}`);
    console.log(`releaseCommit: ${options.releaseCommit}`);
    const dryRun = options.dryRun ? options.dryRun.toLocaleLowerCase() === 'true' : false;
    console.log(`dry run: ${dryRun}`);

    const commit = await getCommit();
    if (!commit) {
        logError('Failed to find commit.');
        return;
    }

    const [tag, message] = getTagAndMessage(options.releaseVersion);
    console.log(`tag: ${tag}`);
    console.log(`message: ${message}`);

    // The compiled option value in js type is 'any' type.
    if (dryRun) {
        console.log('Tagging is skipped in dry run mode.');
        return;
    } else {
        const tagCreated = await tagRepoAsync(owner, repo, commit, tag, message, options.githubPAT);

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
    githubPAT: string | null
): Promise<boolean> {
    const pat = githubPAT ?? process.env['GitHubPAT'];
    if (!pat) {
        throw 'No GitHub Pat found. Specify with --githubPAT or set GitHubPAT environment variable.';
    }

    console.log(`Start to tag ${owner}/${repo}. Commit: ${commit}, tag: ${releaseTag}, message: ${tagMessage}`);
    const octokit = new Octokit({ auth: pat });
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

    console.log(`Tag is created.`);
    return true;
}

function logError(message: string): void {
    console.log(`##vso[task.logissue type=error]${message}`);
}
async function getCommitFromNugetAsync(packageInfo: NugetPackageInfo): Promise<string | null> {
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
    const packageDir = path.join('out', '.nuget', packageName, packageVersion);
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
    const results = /commit="(.*)"/.exec(nuspecFile);
    if (results == null || results.length == 0) {
        logError('Failed to find commit number from nuspec file');
        return null;
    }

    if (results.length != 2) {
        logError('Unexpected regex match result from nuspec file.');
        return null;
    }

    const commitNumber = results[1];
    console.log(`commitNumber is ${commitNumber}`);
    return commitNumber;
}

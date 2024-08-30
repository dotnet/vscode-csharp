/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as fs from 'fs';
import * as minimist from 'minimist';
import { Octokit } from '@octokit/rest';

interface Options {
    releaseVersion: string;
    releaseCommit: string;
    // Even it is specified as boolean, it would still be parsed as string in compiled js.
    dryRun: string;
}

gulp.task('createTags', async (): Promise<void> => {
    const options = minimist<Options>(process.argv.slice(2));
    console.log(`releaseVersion: ${options.releaseVersion}`);
    console.log(`releaseCommit: ${options.releaseCommit}`);
    const dryRun = options.dryRun.toLocaleLowerCase() === 'true';
    console.log(`dry run: ${dryRun}`);

    const roslynCommit = await findRoslynCommitAsync();
    if (!roslynCommit) {
        logError('Failed to find roslyn commit.');
        return;
    }

    // The compiled option value in js type is 'any' type.
    if (dryRun) {
        console.log('Tagging is skipped in dry run mode.');
        return;
    } else {
        const tagCreatedInRoslyn = await tagRepoAsync(
            'dotnet',
            'roslyn',
            roslynCommit,
            `VSCode-CSharp-${options.releaseVersion}`,
            `${options.releaseVersion} VSCode C# extension release`
        );

        if (!tagCreatedInRoslyn) {
            logError('Failed to tag roslyn');
            return;
        }

        console.log('tag created in roslyn');

        const tagCreatedInVsCodeCsharp = await tagRepoAsync(
            'dotnet',
            'vscode-csharp',
            options.releaseCommit,
            `v${options.releaseVersion}`,
            options.releaseVersion
        );

        if (!tagCreatedInVsCodeCsharp) {
            logError('Failed to tag vscode-csharp');
            return;
        }

        console.log('tag created in vscode-csharp');
    }
});

async function findRoslynCommitAsync(): Promise<string | null> {
    const packageJsonString = fs.readFileSync('./package.json').toString();
    const packageJson = JSON.parse(packageJsonString);
    const roslynVersion = packageJson['defaults']['roslyn'];
    if (!roslynVersion) {
        logError("Can't find roslyn version in package.json");
        return null;
    }

    console.log(`Roslyn version is ${roslynVersion}`);
    // Nuget package should exist under out/.nuget/ since we have run the install dependencies task.
    const nuspecFile = fs
        .readFileSync(
            `out/.nuget/microsoft.codeanalysis.languageserver.linux-x64/${roslynVersion}/microsoft.codeanalysis.languageserver.linux-x64.nuspec`
        )
        .toString();
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

async function tagRepoAsync(
    owner: string,
    repo: string,
    commit: string,
    releaseTag: string,
    tagMessage: string
): Promise<boolean> {
    const pat = process.env['GitHubPAT'];
    if (!pat) {
        throw 'No GitHub Pat found.';
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

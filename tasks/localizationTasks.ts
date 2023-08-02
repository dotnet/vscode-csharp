/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as process from 'node:process';
import * as minimist from 'minimist';
import { spawnSync } from 'node:child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'node:util';
import { EOL } from 'node:os';
import { Octokit } from '@octokit/rest';

type Options = {
    userName: string;
    email: string;
    owner: string;
    commitSha: string;
    targetRemoteRepo: string;
    baseBranch: string;
};

const localizationLanguages = ['cs', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-br', 'ru', 'tr', 'zh-cn', 'zh-tw'];
const locFiles = ['bundle.l10n.%s.json', 'package.nls.%s.json'];

function getGeneratedLocalizationChanges(diffFilesAndDirectories: string[]): string[] {
    if (diffFilesAndDirectories.length == 0) {
        return [];
    }

    const allPossibleLocalizationFileNames = getAllPossibleLocalizationFileNames();
    const changedLocFilesOrDirectory = [];

    for (const diffFileOrDirectory of diffFilesAndDirectories) {
        const stat = fs.statSync(diffFileOrDirectory);
        if (
            stat.isFile() &&
            allPossibleLocalizationFileNames.some((locFileName) => path.basename(diffFileOrDirectory) === locFileName)
        ) {
            console.log(`${diffFileOrDirectory} is changed.`);
            changedLocFilesOrDirectory.push(diffFileOrDirectory);
        }

        if (stat.isDirectory() && diffFileOrDirectory !== 'l10n') {
            console.log('l10n is changed.');
            changedLocFilesOrDirectory.push('l10n');
        }
    }

    return changedLocFilesOrDirectory;
}

function getAllPossibleLocalizationFileNames(): string[] {
    const files = [];
    for (const lang of localizationLanguages) {
        for (const file of locFiles) {
            files.push(util.format(file, lang));
        }
    }
    // English
    files.push('bundle.l10n.json');
    return files;
}

async function git_diff(args: string[]): Promise<string[]> {
    const result = await git(['diff'].concat(args));
    // Line ending from the stdout of git is '\n' even on Windows.
    return result
        .replaceAll('\n', EOL)
        .split(EOL)
        .map((fileName, _) => fileName.trim())
        .filter((fileName) => fileName.length !== 0);
}

async function git(args: string[], printCommand = true): Promise<string> {
    if (printCommand) {
        console.log(`git ${args.join(' ')}`);
    }

    const git = spawnSync('git', args);
    if (git.status != 0) {
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

gulp.task('publish localization content', async () => {
    const parsedArgs = minimist<Options>(process.argv.slice(2));
    await git(['add', '-A']);
    const diffResults = await git_diff(['--name-only', 'HEAD']);
    if (diffResults.length == 0) {
        console.log('No git file changes');
        return;
    }

    const localizationChanges = getGeneratedLocalizationChanges(diffResults);
    if (localizationChanges.length == 0) {
        console.log('No localization file changed');
        return;
    }
    await git(['reset']);
    const newBranchName = `localization/${parsedArgs.commitSha}`;
    await git(['config', '--local', 'user.name', parsedArgs.userName]);
    await git(['config', '--local', 'user.email', parsedArgs.email]);

    console.log(`Changed files going to be staged: ${localizationChanges}`);
    await git(['add'].concat(localizationChanges));
    await git(['checkout', '-b', newBranchName]);
    await git(['commit', '-m', `Localization result of ${parsedArgs.commitSha}.`]);

    const pat = process.env['GitHubPAT'];
    if (!pat) {
        throw 'No GitHub Pat found.';
    }

    const remoteRepoAlias = 'targetRepo';
    await git(
        [
            'remote',
            'add',
            remoteRepoAlias,
            `https://${parsedArgs.userName}:${pat}@github.com/${parsedArgs.owner}/${parsedArgs.targetRemoteRepo}.git`,
        ],
        // Note: don't print PAT to console
        false
    );
    await git(['fetch', 'targetRepo']);

    const lsRemote = await git(['ls-remote', remoteRepoAlias, 'refs/head/' + newBranchName]);
    if (lsRemote.trim() !== '') {
        // If the localization branch of this commit already exists, don't try to create another one.
        console.log(`${newBranchName} already exists in ${parsedArgs.targetRemoteRepo}. Skip pushing.`);
    } else {
        await git(['push', '-u', remoteRepoAlias]);
    }

    const octokit = new Octokit({ auth: pat });
    const listPullRequest = await octokit.rest.pulls.list({
        owner: parsedArgs.owner,
        repo: parsedArgs.targetRemoteRepo,
    });

    if (listPullRequest.status != 200) {
        throw `Failed get response from GitHub, http status code: ${listPullRequest.status}`;
    }

    const title = `Localization result based on ${parsedArgs.commitSha}`;
    if (listPullRequest.data.some((pr) => pr.title === title)) {
        console.log('Pull request with the same name already exists. Skip creation.');
        return;
    }

    const pullRequest = await octokit.rest.pulls.create({
        body: title,
        owner: parsedArgs.owner,
        repo: parsedArgs.targetRemoteRepo,
        title: title,
        head: newBranchName,
        base: parsedArgs.baseBranch,
    });

    console.log(`Created pull request: ${pullRequest.data.html_url}.`);
});

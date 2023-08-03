/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as process from 'node:process';
import * as minimist from 'minimist';
import { spawnSync } from 'node:child_process';
import * as path from 'path';
import * as util from 'node:util';
import { EOL } from 'node:os';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';

type Options = {
    userName?: string;
    email?: string;
    commitSha: string;
    targetRemoteRepo: string;
    baseBranch: string;
};

const localizationLanguages = ['cs', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-br', 'ru', 'tr', 'zh-cn', 'zh-tw'];
const locFiles = ['bundle.l10n.%s.json', 'package.nls.%s.json'];

function getAllPossibleLocalizationFiles(): string[] {
    const files = [];
    for (const lang of localizationLanguages) {
        for (const file of locFiles) {
            const filePath = 'l10n' + path.sep + util.format(file, lang);
            files.push(filePath);
        }
    }

    // English
    files.push(`l10n${path.sep}bundle.l10n.json`);
    files.forEach((file) => {
        if (!fs.existsSync(file)) {
            throw `${file} doesn't exist!`;
        }
    });

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
    const localizationChanges = getAllPossibleLocalizationFiles();
    await git(['add'].concat(localizationChanges));

    const diff = await git_diff(['--name-only', 'HEAD']);
    if (diff.length == 0) {
        console.log('No localization file changed');
        return;
    }
    console.log(`Changed files going to be staged: ${diff}`);

    const newBranchName = `localization/${parsedArgs.commitSha}`;
    // Make this optional so it can be tested locally by using dev's information. In real CI user name and email are always supplied.
    if (parsedArgs.userName) {
        await git(['config', '--local', 'user.name', parsedArgs.userName]);
    }
    if (parsedArgs.email) {
        await git(['config', '--local', 'user.email', parsedArgs.email]);
    }

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
            `https://${parsedArgs.userName}:${pat}@github.com/dotnet/${parsedArgs.targetRemoteRepo}.git`,
        ],
        // Note: don't print PAT to console
        false
    );
    await git(['fetch', remoteRepoAlias]);

    const lsRemote = await git(['ls-remote', remoteRepoAlias, 'refs/head/' + newBranchName]);
    if (lsRemote.trim() !== '') {
        // If the localization branch of this commit already exists, don't try to create another one.
        console.log(
            `##vso[task.logissue type=error]${newBranchName} already exists in ${parsedArgs.targetRemoteRepo}. Skip pushing.`
        );
    } else {
        await git(['push', '-u', remoteRepoAlias]);
    }

    const octokit = new Octokit({ auth: pat });
    const listPullRequest = await octokit.rest.pulls.list({
        owner: 'dotnet',
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
        owner: 'dotnet',
        repo: parsedArgs.targetRemoteRepo,
        title: title,
        head: newBranchName,
        base: parsedArgs.baseBranch,
    });

    console.log(`Created pull request: ${pullRequest.data.html_url}.`);
});

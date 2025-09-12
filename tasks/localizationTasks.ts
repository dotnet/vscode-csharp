/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as process from 'node:process';
import minimist from 'minimist';
import { spawnSync } from 'node:child_process';
import * as path from 'path';
import * as util from 'node:util';
import { EOL } from 'node:os';
import { configureGitUser, createCommit, pushBranch, createPullRequest } from './gitTasks';

type Options = {
    userName?: string;
    email?: string;
    commitSha: string;
    targetRemoteRepo: string;
    baseBranch: string;
};

const localizationLanguages = ['cs', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-br', 'ru', 'tr', 'zh-cn', 'zh-tw'];

function getAllPossibleLocalizationFiles(): string[] {
    const files = [];
    for (const lang of localizationLanguages) {
        files.push('l10n' + path.sep + util.format('bundle.l10n.%s.json', lang));
        files.push(util.format('package.nls.%s.json', lang));
    }
    // English
    files.push(`l10n${path.sep}bundle.l10n.json`);
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

    const title = `Localization result based on ${parsedArgs.commitSha}`;
    const commitMessage = `Localization result of ${parsedArgs.commitSha}`;
    const pat = process.env['GitHubPAT'];
    if (!pat) {
        throw 'No GitHub Pat found.';
    }

    const newBranchName = `localization/${parsedArgs.commitSha}`;

    try {
        // Configure git user credentials
        await configureGitUser(parsedArgs.userName, parsedArgs.email);

        // Create branch and commit changes
        await createCommit(newBranchName, ['.'], commitMessage);

        // Push branch to remote
        await pushBranch(newBranchName, pat, 'dotnet', parsedArgs.targetRemoteRepo);

        // Create pull request
        const prUrl = await createPullRequest(
            pat,
            'dotnet',
            parsedArgs.targetRemoteRepo,
            newBranchName,
            title,
            title, // Using title as body as well
            parsedArgs.baseBranch
        );

        if (prUrl) {
            console.log(`Created pull request: ${prUrl}`);
        }
    } catch (error) {
        console.error('Error creating branch and PR:', error);
        throw error;
    }
});

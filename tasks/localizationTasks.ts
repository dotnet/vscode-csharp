/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as process from 'node:process';
import * as minimist from 'minimist';
import { createTokenAuth } from '@octokit/auth-token';
import { spawnSync } from 'node:child_process';
import * as fs from 'fs';
import * as util from 'node:util';
import { EOL } from 'node:os';
import { Octokit } from '@octokit/rest';

type Options = {
    userName: string;
    email: string;
    commitSha: string;
    targetRemoteRepo: string;
    baseBranch: string;
    codeOwnwer: string;
    pat?: string;
};

const localizationLanguages = ['cs', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-br', 'ru', 'tr', 'zh-cn', 'zh-tw'];
const locFiles = ['bundle.l10n.%s.json', 'package.nls.%s.json'];

function onlyLocalizationFileAreGenerated(diffFilesAndDirectories: string[]): boolean {
    if (diffFilesAndDirectories.length == 0) {
        return false;
    }

    const allPossibleLocalizationFileNames = getAllPossibleLocalizationFileNames();

    for (const fileOrDirectory of diffFilesAndDirectories) {
        const stat = fs.statSync(fileOrDirectory);
        if (stat.isFile() && !allPossibleLocalizationFileNames.some((name) => fileOrDirectory.endsWith(name))) {
            console.log(`${fileOrDirectory} is not a localization file.`);
            return false;
        }

        if (stat.isDirectory() && fileOrDirectory !== 'l10n') {
            console.log(`${fileOrDirectory} is not a localization directory.`);
            return false;
        }
    }

    return true;
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

gulp.task('publish localization content', async () => {
    const parsedArgs = minimist<Options>(process.argv.slice(2));
    await git(['add', '-A']);
    const diffResults = await git_diff(['--name-only', 'HEAD']);
    if (diffResults.length == 0) {
        console.log('No localization files generated.');
        return;
    }

    console.log(`Diff Result: ${diffResults}.`);
    if (!onlyLocalizationFileAreGenerated(diffResults)) {
        throw 'Invalid localization files are generated, it is very likely to be an error, skip PR creation.';
    }

    console.log('Authenticate PAT.');
    const pat = parsedArgs.pat ?? process.env['GitHubPAT'];
    if (!pat) {
        throw 'No GitHub Pat found.';
    }

    const auth = createTokenAuth(pat);
    await auth();
    await git(['add', 'targetRepo', parsedArgs.targetRemoteRepo]);
    await git(['fetch', 'targetRepo']);
    const newBranchName = `localization/${parsedArgs.commitSha}`;
    const lsRemote = await git(['ls-remote', 'targetRepo', 'refs/head/' + newBranchName]);
    if (lsRemote.trim() !== '') {
        // If the localization branch of this commit already exists, don't try to create another one.
        console.log(`${newBranchName} alreay exists in ${parsedArgs.targetRemoteRepo}.`);
        return;
    }

    await git(['config', '--local', 'user.name', parsedArgs.userName]);
    await git(['config', '--local', 'user.email', parsedArgs.email]);
    await git(['checkout', '-b', `localization/${parsedArgs.commitSha}`]);
    await git(['commit', '-m', `Localization result of ${parsedArgs.commitSha}.`]);
    await git(['push', '-u', parsedArgs.targetRemoteRepo]);

    const octokit = new Octokit(auth);
    octokit.rest.pulls.create({
        body: `Localization result based on ${parsedArgs.commitSha}`,
        owner: parsedArgs.codeOwnwer,
        repo: parsedArgs.targetRemoteRepo,
        title: `Localization result based on ${parsedArgs.commitSha}`,
        head: newBranchName,
        base: parsedArgs.baseBranch,
    });
});

async function git_diff(args: string[]): Promise<string[]> {
    const result = await git(['diff'].concat(args));
    // Line ending from the stdout of git is '\n' even on Windows.
    return result
        .replaceAll('\n', EOL)
        .split(EOL)
        .map((fileName, _) => fileName.trim())
        .filter((fileName) => fileName.length !== 0);
}

async function git(args: string[]): Promise<string> {
    console.log(`git ${args.join(' ')}`);
    const git = spawnSync('git', args);
    if (git.status != 0) {
        const err = git.stderr.toString();
        console.log(`Failed to execute git ${args.join(' ')}.`);
        throw err;
    }

    const stdout = git.stdout.toString();
    return stdout;
}

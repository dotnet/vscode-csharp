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

type Options = {
    userName: string;
    email: string;
    commitSha: string;
    targetRemoteRepo: string;
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
    await git_add(['-A']);
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
    await git_config(['--local', 'user.name', parsedArgs.userName]);
    await git_config(['--local', 'user.email', parsedArgs.email]);
    await git_remote(['add', 'targetRepo', parsedArgs.targetRemoteRepo]);
    await git_fetch(['targetRepo']);
    await git_checkout(['-b', `localization/${parsedArgs.commitSha}`]);
    await git_commit(['-m', `Localization result of ${parsedArgs.commitSha}.`]);
    await git_push(['-u', parsedArgs.targetRemoteRepo]);
});

async function git_config(options: string[]) {
    await git('config', options);
}

async function git_fetch(options: string[]): Promise<void> {
    await git('fetch', options);
}

async function git_remote(options: string[]): Promise<void> {
    await git('remote', options);
}

async function git_push(options: string[]): Promise<void> {
    await git('push', options);
}

async function git_checkout(options: string[]): Promise<void> {
    await git('checkout', options);
}

async function git_add(filesOrDirectories: string[]): Promise<void> {
    await git('add', filesOrDirectories);
}

async function git_commit(options: string[]): Promise<void> {
    await git('commit', options);
}

async function git_diff(args?: string[]): Promise<string[]> {
    const result = await git('diff', args);
    // Line ending from the stdout of git is '\n' even on Windows.
    return result
        .replaceAll('\n', EOL)
        .split(EOL)
        .map((fileName, _) => fileName.trim())
        .filter((fileName) => fileName.length !== 0);
}

async function git(command: string, args?: string[]): Promise<string> {
    const childProcessArgs = [command].concat(args ?? []);
    console.log(`git ${childProcessArgs.join(' ')}`);
    const git = spawnSync('git', childProcessArgs);
    if (git.status != 0) {
        const err = git.stderr.toString();
        console.log(`Failed to execute git ${command}.`);
        throw err;
    }

    const stdout = git.stdout.toString();
    return stdout;
}

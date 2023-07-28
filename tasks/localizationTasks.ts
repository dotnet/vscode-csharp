/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as process from 'node:process';
import { EOL } from 'os';
import * as minimist from 'minimist';
import { createTokenAuth } from '@octokit/auth-token';
import { spawnSync } from 'node:child_process';

type Options = {
    userName: string;
    email: string;
    commitSha: string;
    targetRemoteRepo: string;
    pat?: string;
};

gulp.task('publish localization content', async () => {
    const parsedArgs = minimist<Options>(process.argv.slice(2));
    console.log(parsedArgs);
    await git_add(['-A']);
    const diffResults = await git_diff(['HEAD', '--name-only']);
    if (diffResults.length == 0) {
        console.log('No localization files generated.');
        return;
    }

    if (diffResults.some((file) => !file.endsWith('.json'))) {
        console.log('non-json files are modified, it is very likely to be an error, skip PR creation.');
        return;
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
    await git_commit(`Localization result of ${parsedArgs.commitSha}. `);
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

async function git_commit(commitMessage: string): Promise<void> {
    await git('commit', ['-m', commitMessage]);
}

async function git_diff(args?: string[]): Promise<string[]> {
    const result = await git('diff', args);
    return result.split(EOL).map((fileName, _) => fileName.trim());
}

async function git(command: string, args?: string[]): Promise<string> {
    const errorMessage = `Failed to execute git ${command}`;
    try {
        console.log(`git ${command} ${args}`);
        const git = spawnSync('git', [command].concat(args ?? []));
        const err = git.stderr.toString();
        if (err.length > 0) {
            console.log(errorMessage);
            throw err;
        }

        const stdio = git.stdout.toString();
        return stdio;
    } catch (err) {
        console.log(err);
        throw err;
    }
}

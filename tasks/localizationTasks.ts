/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import spawnNode from './spawnNode';
import * as process from 'node:process';
import { EOL } from 'os';
import * as fs from 'fs';
import * as minimist from 'minimist';
import { createTokenAuth } from '@octokit/auth-token';

type Options = {
    userName: string;
    email: string;
    commitSha: string;
    targetRemoteRepo: string;
};

gulp.task('publish localization content', async () => {
    const parsedArgs = minimist<Options>(process.argv.slice(2));
    console.log(parsedArgs);
    const diffResults = await git_diff();
    if (diffResults.length == 0) {
        console.log('No localization files generated.');
        return;
    }

    if (diffResults.some((file) => !file.endsWith('.json'))) {
        console.log('non-json files are modified, it is very likely to be an error, skip PR creation.');
        return;
    }

    console.log('Authenticate PAT.');
    const pat = process.env['GitHubPAT'];
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
    await git_add(diffResults);
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

async function git_diff(): Promise<string[]> {
    const result = await git('diff', ['--name-only']);
    return result
        .split(EOL)
        .map((fileName, _) => fileName.trim())
        .filter((fileName) => {
            if (fileName == '') {
                return false;
            }
            const stat = fs.lstatSync(fileName);
            return stat.isFile || stat.isDirectory;
        });
}

async function git(command: string, args?: string[]): Promise<string> {
    const errorMessage = `Failed to execute git ${command}`;
    try {
        console.log(`git ${command} ${args}`);
        const { code, stdout } = await spawnNode(['git', command].concat(args ?? []));
        if (code !== 0) {
            throw errorMessage;
        }
        if (typeof stdout === 'string') {
            return stdout;
        } else {
            return stdout.toString();
        }
    } catch (err) {
        console.log(err);
        throw err;
    }
}

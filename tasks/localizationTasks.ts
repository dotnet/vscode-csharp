/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import spawnNode from './spawnNode';
import * as process from 'node:process';
import { EOL } from 'os';
import * as fs from 'fs';

gulp.task('publish localization content', async () => {
    const userName = process.argv[1];
    const email = process.argv[2];
});

async function git_fetch(options: string[]): Promise<void> {
    await git('fetch', options);
}

async function git_remote(options: string[]): Promise<void> {
    await git('remote', options);
}

async function git_push(): Promise<void> {
    await git('push');
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

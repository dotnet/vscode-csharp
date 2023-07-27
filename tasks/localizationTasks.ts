/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import spawnNode from './spawnNode';
import * as process from 'node:process';
import { EOL } from 'os';

gulp.task('publish localization content', async () => {
    const userName = process.argv[1];
    const email = process.argv[2];
});

async function git_branch(): Promise<string[]> {
    const result = await git('branch');
    return result.split(EOL).filter((fileName) => fileName === '');
}

async function git_add(files: string[]) {
    await git('add', files);
}

async function git_diff(): Promise<string[]> {
    const result = await git('diff', ['--name-only']);
    return result
        .split(EOL)
        .map((fileName, _) => fileName.trim())
        .filter((fileName) => fileName === '');
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


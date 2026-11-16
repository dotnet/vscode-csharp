/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SpawnSyncOptions, spawnSync } from 'child_process';

export default async function spawnGit(args?: string[], options?: SpawnSyncOptions) {
    if (!options) {
        options = {
            env: {},
        };
    }

    const optionsWithFullEnvironment: SpawnSyncOptions = {
        ...options,
        env: {
            ...process.env,
            ...options.env,
        },
    };

    const buffer = spawnSync('git', args, optionsWithFullEnvironment);

    // Surface Git failures so workspace cleanup can retry instead of silently leaving fixtures in an invalid state.
    if (buffer.error) {
        throw buffer.error;
    }
    if (buffer.status !== 0) {
        throw new Error(
            `git ${args?.join(' ')} failed (exit code ${buffer.status}, signal ${buffer.signal}).
${buffer.stdout?.toString() ?? ''}
${buffer.stderr?.toString() ?? ''}`
        );
    }

    return { code: buffer.status, signal: buffer.signal, stdout: buffer.stdout?.toString() ?? '' };
}

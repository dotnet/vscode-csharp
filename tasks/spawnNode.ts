/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawnSync, SpawnSyncOptions } from 'child_process';
import { nodePath, rootPath } from './projectPaths';

export default async function spawnNode(args?: string[], options?: SpawnSyncOptions) {
    if (!options) {
        options = {
            env: {},
            stdio: 'inherit',
        };
    }

    const optionsWithFullEnvironment: SpawnSyncOptions = {
        cwd: rootPath,
        ...options,
        env: {
            ...process.env,
            ...options.env,
        },
        stdio: options.stdio ?? 'inherit',
    };

    console.log(`starting ${nodePath} ${args ? args.join(' ') : ''}`);

    const buffer = spawnSync(nodePath, args, optionsWithFullEnvironment);

    return { code: buffer.status, signal: buffer.signal, stdout: buffer.stdout };
}

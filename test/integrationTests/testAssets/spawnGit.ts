/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SpawnSyncOptions, spawnSync } from "child_process";

export default async function spawnGit(args?: string[], options?: SpawnSyncOptions) {
    if (!options) {
        options = {
            env: {}
        };
    }

    let optionsWithFullEnvironment: SpawnSyncOptions = {
        ...options,
        env: {
            ...process.env,
            ...options.env
        }
    };

    const buffer = spawnSync('git', args, optionsWithFullEnvironment);

    return { code: buffer.status, signal: buffer.signal };
}
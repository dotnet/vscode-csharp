/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { SpawnOptions, spawn } from "child_process";
import { join, Result } from "async-child-process";

export default async function spawnGit(args?: string[], options?: SpawnOptions): Promise<Result> {
    if (!options) {
        options = {
            env: {}
        };
    }

    let optionsWithFullEnvironment = {
        ...options,
        env: {
            ...process.env,
            ...options.env
        }
    };

    let spawned = spawn('git', args, optionsWithFullEnvironment);

    //spawned.stdout.on('data', (data) => console.log(data.toString()));
    //spawned.stderr.on('data', (data) => console.log(data.toString()));

    return join(spawned);
}
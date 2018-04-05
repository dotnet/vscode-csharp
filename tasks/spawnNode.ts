/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { SpawnOptions, ChildProcess, spawn } from "child_process";
import { nodePath, rootPath } from "./projectPaths";

export default function spawnNode(onError, args?: string[], options?: SpawnOptions): ChildProcess {
    if (!options) {
        options = {
            env: {}
        };
    }
    
    let optionsWithFullEnvironment = {
        cwd: rootPath,
        ...options,
        env: {
            ...process.env,
            ...options.env
        }
    };
    
    let spawned = spawn(nodePath, args, optionsWithFullEnvironment);

    spawned.stdout.on('data', (data) => console.log(data.toString()));
    spawned.stderr.on('data', (data) => console.log(data.toString()));
    spawned.on('exit', (code, signal) => onError(code));

    return spawned;
}
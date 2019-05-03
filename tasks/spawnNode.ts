/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { SpawnOptions, spawn } from "child_process";
import { nodePath, rootPath } from "./projectPaths";
const { join } = require("async-child-process");

export default async function spawnNode(args?: string[], options?: SpawnOptions): Promise<{code: string; signal: string;}> {
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
    
    console.log(`starting ${nodePath} ${args.join(' ')}`);

    let spawned = spawn(nodePath, args, optionsWithFullEnvironment);
    
    let errorString = "";
    spawned.stderr.on("readable", function (buffer:any) {
        let part = buffer.read().toString();
        errorString += part;
        console.log('error:' + part);
    });

    spawned.stderr.on('end',function(){
        console.log('final error ' + errorString);
    });

    let outputString = "";
    spawned.stderr.on("readable", function (buffer:any) {
        let part = buffer.read().toString();
        outputString += part;
        console.log('output:' + part);
    });

    spawned.stderr.on('end',function(){
        console.log('final output ' + outputString);
    });

    spawned.stdout.on("data", chunk =>
        console.log(chunk));

    return join(spawned);
}
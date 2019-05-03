/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { SpawnOptions, spawnSync } from "child_process";
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

    let spawned = spawnSync(nodePath, args, optionsWithFullEnvironment);
    
    console.log("error:", spawned.stderr.toString());
    console.log("output:", spawned.stdout.toString());
    // let errorString = "";
    // spawned.stderr.to("readable", function (buffer:any) {
    //     let part = spawned.stderr.read();
    //     if(part){
    //         errorString += part.toString();
    //         console.log('error:' + part.toString());
    //     }
        
    // });

    // spawned.stderr.on('end',function(){
    //     console.log('final error ' + errorString);
    // });

    // let outputString = "";
    // spawned.stdout.on("readable", function (buffer:any) {
    //     let part = spawned.stdout.read();
    //     if(part){
    //         outputString += part.toString();
    //         console.log('output:' + part.toString());
    //     }
    // });

    // spawned.stdout.on('end',function(){
    //     console.log('final output ' + outputString);
    // });

    return join(spawned);
}
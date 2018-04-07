/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';

export function invokeNode(args: string[]){
    let proc = cp.spawnSync('node', args);
    if (proc.error) {
        console.error(proc.error.toString());
    }
}
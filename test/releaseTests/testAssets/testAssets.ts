/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';

export function invokeCommand(command: string): Promise<{ stdout: string, stderr: string }> {
    return new Promise((resolve, reject) => {
        let child = cp.exec(command,
            (err, stdout, stderr) => {
                return err ? reject(err) : resolve({
                    stdout: stdout,
                    stderr: stderr
                });
            });
    });
}

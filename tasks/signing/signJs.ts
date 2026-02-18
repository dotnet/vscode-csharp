/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path from 'path';
import { rootPath } from '../projectPaths';
import { execDotnet, getLogPath } from './signingTasks';
import { runTask } from '../runTask';

runTask(signJs);

async function signJs(): Promise<void> {
    const logPath = getLogPath();
    const signType = process.env.SignType;
    if (!signType) {
        console.warn('SignType environment variable is not set, skipping JS signing.');
        return;
    }

    if (signType === 'test' && process.platform !== 'win32') {
        console.log('Test signing is not supported on non-windows platforms. Skipping JS signing.');
        return;
    }
    console.log(`Signing JS as ${signType}`);
    await execDotnet([
        'build',
        path.join(rootPath, 'msbuild', 'signing', 'signJs'),
        `-bl:${path.join(logPath, 'signJs.binlog')}`,
        `/p:JSOutputPath=${path.join(rootPath, 'dist')}`,
    ]);
}

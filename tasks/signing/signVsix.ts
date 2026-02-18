/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path from 'path';
import { rootPath } from '../projectPaths';
import { execDotnet, getLogPath } from './signingTasks';
import { runTask } from '../runTask';

runTask(signVsix);

async function signVsix(): Promise<void> {
    const logPath = getLogPath();
    const signType = process.env.SignType;
    if (!signType) {
        console.warn('SignType environment variable is not set, skipping VSIX signing.');
        return;
    }

    if (signType === 'test' && process.platform !== 'win32') {
        console.log('Test signing is not supported on non-windows platforms. Skipping VSIX signing.');
        return;
    }
    console.log(`Signing VSIX as ${signType}`);
    await execDotnet([
        'build',
        path.join(rootPath, 'msbuild', 'signing', 'signVsix'),
        `-bl:${path.join(logPath, 'signVsix.binlog')}`,
    ]);
}

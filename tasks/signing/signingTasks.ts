/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as fs from 'fs';
import { rootPath } from '../projectPaths';
import path from 'path';

export function getLogPath(): string {
    const logPath = path.join(rootPath, 'out', 'logs');
    if (!fs.existsSync(logPath)) {
        fs.mkdirSync(logPath, { recursive: true });
    }
    return logPath;
}

export async function execDotnet(args: string[]): Promise<void> {
    const dotnetArgs = args.join(' ');
    console.log(`dotnet args: dotnet ${dotnetArgs}`);
    const process = cp.spawn('dotnet', args, { stdio: 'inherit' });

    await new Promise((resolve) => {
        process.on('exit', (exitCode, _) => {
            if (exitCode !== 0) {
                throw new Error(`Failed to run command: dotnet ${dotnetArgs}`);
            }
            resolve(undefined);
        });
    });
}

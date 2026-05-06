/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import path from 'path';
import { verifySignature } from '../packaging/vsceTasks';
import { runTask } from '../runTask';

runTask(verifyVsix);

async function verifyVsix(): Promise<void> {
    const signType = process.env.SignType;
    if (!signType) {
        console.warn('SignType environment variable is not set, skipping VSIX verification.');
        return;
    }

    if (signType.toLowerCase() !== 'real') {
        console.log('Signing verification is only supported for real signing. Skipping VSIX verification.');
        return;
    }

    const vsixs = fs.readdirSync('.').filter((file) => path.extname(file) === '.vsix');
    for (const vsixFile in vsixs) {
        console.log(`Verifying signature of ${vsixFile}`);
        await verifySignature(vsixFile);
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'child_process';
import { IGetMonoVersion } from '../constants/IGetMonoVersion';

export const getMonoVersion: IGetMonoVersion = async (environment: NodeJS.ProcessEnv) => {
    const versionRegexp = /(\d+\.\d+\.\d+)/;

    return new Promise((resolve, reject) => {
        const childprocess = spawn('mono', ['--version'], { env: environment });
        childprocess.on('error', () => {
            resolve(undefined);
        });

        let stdout = '';
        childprocess.stdout.on('data', data => {
            stdout += data.toString();
        });

        childprocess.stdout.on('close', () => {
            const match = versionRegexp.exec(stdout);

            if (match && match.length > 1) {
                resolve(match[1]);
            }
            else {
                resolve(undefined);
            }
        });
    });
};

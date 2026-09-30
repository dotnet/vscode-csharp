/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { runTask } from '../runTask';

runTask(repairSigningPython);

async function repairSigningPython(): Promise<void> {
    // MicroBuild invokes `az` from PATH, not necessarily the CLI used for its initial login.
    const az = execFileSync('which', ['az'], { encoding: 'utf8' }).trim();
    const shebang = readFileSync(az, 'utf8').split(/\r?\n/, 1)[0];
    const launcher = /^#!\s*(\/\S+)(?:\s+(python(?:3(?:\.\d+)?)?))?\s*$/.exec(shebang);
    if (!launcher) {
        throw new Error(`Unsupported Azure CLI Python launcher: ${az}: ${shebang}`);
    }

    const python =
        launcher[1] === '/usr/bin/env' && launcher[2]
            ? execFileSync('which', [launcher[2]], { encoding: 'utf8' }).trim()
            : launcher[1];
    if (!/^python(?:3(?:\.\d+)?)?$/.test(path.basename(python)) || (launcher[2] && launcher[1] !== '/usr/bin/env')) {
        throw new Error(`Unsupported Azure CLI Python launcher: ${az}: ${shebang}`);
    }
    console.log(`Repairing signing dependencies for ${az} using ${python}`);

    const cryptography = execFileSync(
        python,
        [
            '-c',
            [
                'import importlib.metadata as m, site',
                'if not site.ENABLE_USER_SITE:',
                "    raise RuntimeError('Signing Python must enable user-site packages')",
                "m.version('xsignextension')",
                "print(m.version('cryptography'))",
            ].join('\n'),
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
    ).trim();

    // Keep the crypto version selected by XSign rather than changing it to accommodate pyOpenSSL.
    execFileSync(
        python,
        [
            '-m',
            'pip',
            'install',
            '--user',
            '--upgrade',
            '--upgrade-strategy',
            'only-if-needed',
            'pyOpenSSL>=26.2.0,<27',
            `cryptography==${cryptography}`,
        ],
        { stdio: 'inherit' }
    );

    // A fresh process must import the bindings that previously failed with X509_V_FLAG_NOTIFY_POLICY.
    execFileSync(
        python,
        [
            '-c',
            'import OpenSSL, OpenSSL.crypto, OpenSSL.SSL, cryptography, azure.cli.core; ' +
                "print('pyOpenSSL:', OpenSSL.__version__, OpenSSL.__file__); " +
                "print('cryptography:', cryptography.__version__, cryptography.__file__)",
        ],
        { stdio: 'inherit' }
    );
    execFileSync(az, ['xsign', '--help'], { stdio: 'inherit' });
}

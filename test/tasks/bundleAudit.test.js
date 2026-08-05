/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test } from '@jest/globals';
import { auditBundle } from '../../tasks/compilation/bundleAudit.mjs';

test('bundle audit rejects first-party CommonJS runtime requires', async () => {
    const metafile = {
        inputs: {
            'src/unexpected.ts': {
                imports: [{ external: true, kind: 'require-call', path: 'node:fs' }],
            },
        },
        outputs: {
            'dist/extension.mjs': {
                exports: ['activate'],
                imports: [{ external: true, kind: 'import-statement', path: 'vscode' }],
            },
        },
    };

    await expect(auditBundle(metafile, false)).rejects.toThrow(
        'First-party source emitted CommonJS runtime requires: src/unexpected.ts -> node:fs'
    );
});

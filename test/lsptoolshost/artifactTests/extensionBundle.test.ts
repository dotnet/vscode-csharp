/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test } from '@jest/globals';
import esbuild from 'esbuild';
import fs from 'fs-extra';
import path from 'node:path';

const packageJson = fs.readJsonSync(path.resolve('package.json'));
const extensionEntry = path.resolve(packageJson.main);

describe('Extension bundle', () => {
    test('package main points to an existing .mjs file', async () => {
        expect(path.extname(packageJson.main)).toBe('.mjs');
        await expect(fs.pathExists(extensionEntry)).resolves.toBe(true);
    });

    test('entry is native ESM with the activation contract', async () => {
        const result = await esbuild.build({
            entryPoints: [extensionEntry],
            bundle: false,
            format: 'esm',
            metafile: true,
            outdir: 'artifact-audit',
            write: false,
        });
        const output = Object.values(result.metafile.outputs)[0];

        expect(output.exports).toEqual(['activate']);
        expect(output.imports).toContainEqual({
            external: true,
            kind: 'import-statement',
            path: 'vscode',
        });
    });

    test('entry provides CommonJS path globals for bundled dependencies', async () => {
        const contents = await fs.readFile(extensionEntry, 'utf8');

        expect(contents).toContain(`import { dirname as __pathDirname } from 'node:path';`);
        expect(contents).toContain(`import { fileURLToPath as __fileURLToPath } from 'node:url';`);
        expect(contents).toContain('const __filename = __fileURLToPath(import.meta.url);');
        expect(contents).toContain('const __dirname = __pathDirname(__filename);');
    });

    test('JavaScript signing includes .mjs output', async () => {
        const signingProject = await fs.readFile(path.resolve('msbuild/signing/signJs/signJs.proj'), 'utf8');
        expect(signingProject).toContain('<FilesToSign Include="$(OutDir)*.mjs">');
    });
});

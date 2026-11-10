/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const script = path.resolve(__dirname, '../../tasks/packaging/nodeModulesCache.ts');

describe('node_modules cache preparation', () => {
    let repositoryPath: string;

    beforeEach(() => {
        repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-csharp-node-modules-cache-'));
        fs.mkdirSync(path.join(repositoryPath, 'tasks/packaging'), { recursive: true });
        fs.copyFileSync(script, path.join(repositoryPath, 'tasks/packaging/nodeModulesCache.ts'));
        fs.writeFileSync(
            path.join(repositoryPath, 'package.json'),
            JSON.stringify({ defaults: { roslyn: '1.0' }, dependencies: { dependency: '1.0' } })
        );
        fs.writeFileSync(path.join(repositoryPath, 'package-lock.json'), '{"lockfileVersion":3}');
        fs.writeFileSync(path.join(repositoryPath, '.npmrc'), 'ignore-scripts=false\n');
    });

    afterEach(() => {
        fs.rmSync(repositoryPath, { recursive: true, force: true });
    });

    function prepare(npmVersion = '11.0.0'): string {
        const result = spawnSync(process.execPath, [script], {
            cwd: repositoryPath,
            env: { ...process.env, npm_config_user_agent: `npm/${npmVersion} node/${process.version}` },
            encoding: 'utf8',
        });
        expect(result.stderr).toBe('');
        expect(result.status).toBe(0);
        return result.stdout.trim();
    }

    test('reuses the npm cache when only component versions change', () => {
        const key = prepare();
        fs.writeFileSync(
            path.join(repositoryPath, 'package.json'),
            JSON.stringify({ defaults: { roslyn: '2.0' }, dependencies: { dependency: '1.0' } })
        );
        expect(prepare()).toBe(key);
    });

    test.each(['package-lock.json', '.npmrc', 'tasks/packaging/nodeModulesCache.ts'])(
        'invalidates when %s changes',
        (file) => {
            const key = prepare();
            fs.appendFileSync(path.join(repositoryPath, file), '\n');
            expect(prepare()).not.toBe(key);
        }
    );

    test('invalidates manifest dependency changes even if the lockfile was not updated', () => {
        const key = prepare();
        fs.writeFileSync(
            path.join(repositoryPath, 'package.json'),
            JSON.stringify({ defaults: { roslyn: '1.0' }, dependencies: { dependency: '2.0' } })
        );
        expect(prepare()).not.toBe(key);
    });

    test('isolates installations made with different npm versions', () => {
        expect(prepare('11.0.0')).not.toBe(prepare('11.1.0'));
    });

    test('clears stale modules before cache restoration without touching checkout files', () => {
        fs.mkdirSync(path.join(repositoryPath, 'node_modules/stale-package'), { recursive: true });
        fs.writeFileSync(path.join(repositoryPath, 'node_modules/stale-package/index.js'), 'stale');
        fs.writeFileSync(path.join(repositoryPath, 'untouched'), 'checkout file');
        prepare();
        expect(fs.readdirSync(path.join(repositoryPath, 'node_modules'))).toEqual([]);
        expect(fs.readFileSync(path.join(repositoryPath, 'untouched'), 'utf8')).toBe('checkout file');
    });
});

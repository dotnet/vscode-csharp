/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const sourceRoot = path.resolve(__dirname, '../..');
const script = path.join(sourceRoot, 'tasks/packaging/componentCache.ts');
const defaults = { roslyn: '1.0', xamlTools: '2.0', testDiscovery: '3.0' };
const components = [
    ['.roslyn', defaults.roslyn],
    ['.roslynDevKit', defaults.roslyn],
    ['.xamlTools', defaults.xamlTools],
    ['.testDiscovery', defaults.testDiscovery],
];

describe('Component cache', () => {
    let tempPath: string;
    let repositoryPath: string;
    let cachePath: string;

    beforeEach(() => {
        tempPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-csharp-component-cache-'));
        repositoryPath = path.join(tempPath, 'repository');
        cachePath = path.join(tempPath, 'cache');
        fs.mkdirSync(repositoryPath);
        fs.writeFileSync(path.join(repositoryPath, 'package.json'), JSON.stringify({ defaults }));
        for (const file of [
            'tasks/packaging/componentCache.ts',
            'tasks/packaging/offlinePackagingTasks.ts',
            'tasks/projectPaths.ts',
            'src/lsptoolshost/extensions/builtInComponents.ts',
        ]) {
            const target = path.join(repositoryPath, file);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(path.join(sourceRoot, file), target);
        }
    });

    afterEach(() => {
        fs.rmSync(tempPath, { recursive: true, force: true });
    });

    function run(operation: string) {
        return spawnSync(process.execPath, [script, operation], {
            cwd: repositoryPath,
            env: { ...process.env, COMPONENT_CACHE_PATH: cachePath },
            encoding: 'utf8',
        });
    }

    function prepare(): string {
        const result = run('prepare');
        expect(result.stderr).toBe('');
        expect(result.status).toBe(0);
        return result.stdout.trim();
    }

    function installComponents(): void {
        for (const [directory, version] of components) {
            const target = path.join(repositoryPath, directory);
            fs.mkdirSync(target);
            fs.writeFileSync(path.join(target, 'version.nfo'), version);
            fs.writeFileSync(path.join(target, 'server'), 'original binary', { mode: 0o755 });
        }
    }

    test('ignores unrelated manifest changes, formatting, and defaults property order', () => {
        const key = prepare();
        fs.writeFileSync(
            path.join(repositoryPath, 'package.json'),
            JSON.stringify(
                {
                    version: '42.0',
                    defaults: Object.fromEntries(Object.entries(defaults).reverse()),
                    description: 'Unrelated extension metadata',
                },
                undefined,
                2
            )
        );
        expect(prepare()).toBe(key);
    });

    test('invalidates when a component version changes', () => {
        const key = prepare();
        fs.writeFileSync(
            path.join(repositoryPath, 'package.json'),
            JSON.stringify({ defaults: { ...defaults, roslyn: '1.1' } })
        );
        expect(prepare()).not.toBe(key);
    });

    test.each([
        'tasks/packaging/componentCache.ts',
        'tasks/packaging/offlinePackagingTasks.ts',
        'tasks/projectPaths.ts',
        'src/lsptoolshost/extensions/builtInComponents.ts',
    ])('invalidates when %s changes', (file) => {
        const key = prepare();
        fs.appendFileSync(path.join(repositoryPath, file), '\n// Changed installation logic\n');
        expect(prepare()).not.toBe(key);
    });

    test('restores a separate snapshot, removes stale files, and preserves executable permissions', () => {
        prepare();
        installComponents();
        expect(run('save').status).toBe(0);
        for (const [directory] of components) {
            const target = path.join(repositoryPath, directory);
            fs.writeFileSync(path.join(target, 'server'), 'modified by tests');
            fs.writeFileSync(path.join(target, 'obsolete'), 'stale file');
        }

        const result = run('restore');
        expect(result.stderr).toBe('');
        expect(result.status).toBe(0);
        for (const [directory, version] of components) {
            const target = path.join(repositoryPath, directory);
            expect(fs.readFileSync(path.join(target, 'version.nfo'), 'utf8')).toBe(version);
            expect(fs.readFileSync(path.join(target, 'server'), 'utf8')).toBe('original binary');
            expect(fs.existsSync(path.join(target, 'obsolete'))).toBe(false);
            if (process.platform !== 'win32') {
                expect(fs.statSync(path.join(target, 'server')).mode & 0o777).toBe(0o755);
            }
        }
    });

    test('does not stage incomplete installations', () => {
        prepare();
        installComponents();
        fs.unlinkSync(path.join(repositoryPath, '.testDiscovery', 'version.nfo'));
        const result = run('save');
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('version.nfo');
        expect(fs.readdirSync(cachePath)).toEqual([]);
    });

    test('rejects a mismatched cached version before replacing installed files', () => {
        prepare();
        installComponents();
        expect(run('save').status).toBe(0);
        fs.writeFileSync(path.join(cachePath, '.testDiscovery', 'version.nfo'), 'wrong version');
        fs.writeFileSync(path.join(repositoryPath, '.roslyn', 'server'), 'untouched');

        const result = run('restore');
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('Unexpected version');
        expect(fs.readFileSync(path.join(repositoryPath, '.roslyn', 'server'), 'utf8')).toBe('untouched');
    });
});

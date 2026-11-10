/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Node 24 runs this without ts-node so the cache can be restored before npm ci.
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { createHash }: typeof import('node:crypto') = require('node:crypto');

const rootPath = process.cwd();
const cachePath = process.env.COMPONENT_CACHE_PATH;
if (!cachePath) {
    throw new Error('COMPONENT_CACHE_PATH must specify the component cache directory.');
}

const { defaults }: { defaults: Record<string, string> } = JSON.parse(
    fs.readFileSync(path.join(rootPath, 'package.json'), 'utf8')
);
const components = [
    ['.roslyn', 'roslyn'],
    ['.roslynDevKit', 'roslyn'],
    ['.xamlTools', 'xamlTools'],
    ['.testDiscovery', 'testDiscovery'],
] as const;

function getCacheKey(): string {
    const hash = createHash('sha256');
    hash.update(
        JSON.stringify({
            platform: process.platform,
            architecture: process.arch,
            defaults: Object.fromEntries(Object.entries(defaults).sort(([a], [b]) => a.localeCompare(b))),
        })
    );
    for (const file of [
        'tasks/packaging/componentCache.ts',
        'tasks/packaging/offlinePackagingTasks.ts',
        'tasks/projectPaths.ts',
        'src/lsptoolshost/extensions/builtInComponents.ts',
    ]) {
        hash.update(fs.readFileSync(path.join(rootPath, file)));
    }
    return hash.digest('hex');
}

function copyComponents(source: string, destination: string): void {
    // Validate all markers before replacing any installed components or staging an incomplete cache.
    for (const [directory, versionKey] of components) {
        const marker = path.join(source, directory, 'version.nfo');
        const expectedVersion = defaults[versionKey];
        const actualVersion = fs.readFileSync(marker, 'utf8');
        if (actualVersion !== expectedVersion) {
            throw new Error(`Unexpected version in ${marker}: expected ${expectedVersion}, found ${actualVersion}.`);
        }
    }

    for (const [directory] of components) {
        const target = path.join(destination, directory);
        fs.rmSync(target, { recursive: true, force: true });
        fs.cpSync(path.join(source, directory), target, { recursive: true, verbatimSymlinks: true });
        console.log(`Copied ${directory} to ${target}`);
    }
}

switch (process.argv[2]) {
    case 'prepare':
        fs.rmSync(cachePath, { recursive: true, force: true });
        fs.mkdirSync(cachePath, { recursive: true });
        console.log(`##vso[task.setvariable variable=ComponentCacheKey]${getCacheKey()}`);
        break;
    case 'restore':
        copyComponents(cachePath, rootPath);
        break;
    case 'save':
        copyComponents(rootPath, cachePath);
        break;
    default:
        throw new Error('Expected a component cache operation: prepare, restore, or save.');
}

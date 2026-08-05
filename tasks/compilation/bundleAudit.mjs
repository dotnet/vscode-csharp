/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'node:fs/promises';

/**
 * The extension is emitted as native ESM, but bundled CommonJS dependencies still use runtime
 * `require()` calls and path globals such as `__dirname`. esbuild.mjs supplies compatibility
 * bridges for them. This audit inspects esbuild's metafile to keep the require boundary explicit:
 *
 * - first-party runtime requires are rejected;
 * - each dependency owner and required target must exactly match this allowlist, so new requires
 *   fail the build and obsolete entries must be removed;
 * - the output must remain an ESM bundle that only exports `activate` and imports `vscode` as ESM.
 *
 * The summary identifies direct and transitive owners to make future package upgrades easier to
 * evaluate. This list describes the generated bundle, not every CommonJS package in node_modules.
 */
const expectedRuntimeRequires = {
    '@microsoft/servicehub-framework': ['assert', 'crypto', 'events', 'net', 'os', 'path', 'stream', 'util'],
    '@vscode/js-debug-browsers': ['child_process', 'fs', 'os', 'path'],
    '@vscode/l10n': ['fs', 'fs/promises'],
    'agent-base': ['http', 'https', 'net'],
    archiver: ['buffer', 'events', 'fs', 'path', 'stream', 'util', 'zlib'],
    'archiver-utils': ['path', 'stream', 'util'],
    bl: ['buffer', 'events', 'stream', 'util'],
    'buffer-crc32': ['buffer'],
    'compress-commons': ['buffer', 'events', 'stream', 'util'],
    'crc32-stream': ['buffer', 'events', 'stream', 'util', 'zlib'],
    'cross-spawn': ['child_process', 'fs', 'path'],
    debug: ['tty', 'util'],
    execa: ['child_process', 'os', 'path'],
    'fs-constants': ['constants', 'fs'],
    'fs-extra': ['path'],
    'fs.realpath': ['fs', 'path'],
    'get-stream': ['buffer', 'stream'],
    glob: ['assert', 'events', 'fs', 'path', 'util'],
    'graceful-fs': ['assert', 'constants', 'fs', 'stream', 'util'],
    'http-proxy-agent': ['events', 'net', 'tls'],
    'https-proxy-agent': ['assert', 'net', 'tls'],
    inherits: ['util'],
    isexe: ['fs'],
    jsonfile: ['fs'],
    lazystream: ['util'],
    'merge-stream': ['stream'],
    // Razor is a version-pinned component tarball. Update it through component servicing, not npm.
    'microsoft.aspnetcore.razor.vscode': [
        'child_process',
        'crypto',
        'events',
        'fs',
        'net',
        'os',
        'path',
        'url',
        'util',
        'vscode',
    ],
    minimatch: ['path'],
    'msgpack-lite': ['stream', 'util'],
    'nerdbank-streams': ['crypto', 'events', 'stream'],
    'node-machine-id': ['child_process', 'crypto'],
    'npm-run-path': ['path'],
    'ps-list': ['child_process', 'path', 'util'],
    pump: ['fs'],
    'readable-stream': ['events', 'stream', 'util'],
    'readdir-glob': ['events', 'fs', 'path'],
    'safe-buffer': ['buffer'],
    'signal-exit': ['assert', 'events'],
    'supports-color': ['os', 'tty'],
    'tar-stream': ['buffer', 'events', 'stream', 'string_decoder', 'util'],
    'util-deprecate': ['util'],
    'vscode-jsonrpc': ['crypto', 'fs', 'net', 'os', 'path', 'util'],
    'vscode-languageclient': ['child_process', 'fs', 'path', 'readline', 'vscode'],
    which: ['path'],
    yauzl: ['events', 'fs', 'stream', 'util', 'zlib'],
    'zip-stream': ['util'],
};

function getPackageOwner(inputPath) {
    const normalizedPath = inputPath.replaceAll('\\', '/');
    const marker = 'node_modules/';
    const markerIndex = normalizedPath.indexOf(marker);
    if (markerIndex < 0) {
        return undefined;
    }

    const [firstSegment, secondSegment] = normalizedPath.slice(markerIndex + marker.length).split('/');
    return firstSegment.startsWith('@') ? `${firstSegment}/${secondSegment}` : firstSegment;
}

function getRuntimeRequires(metafile) {
    const packageRequires = new Map();
    const firstPartyRequires = [];

    for (const [inputPath, input] of Object.entries(metafile.inputs)) {
        for (const imported of input.imports) {
            if (!imported.external || !['require-call', 'require-resolve'].includes(imported.kind)) {
                continue;
            }

            const packageOwner = getPackageOwner(inputPath);
            if (!packageOwner) {
                firstPartyRequires.push(`${inputPath} -> ${imported.path}`);
                continue;
            }

            let record = packageRequires.get(packageOwner);
            if (!record) {
                record = { imports: 0, inputs: new Set(), targets: new Set() };
                packageRequires.set(packageOwner, record);
            }

            record.imports++;
            record.inputs.add(inputPath);
            record.targets.add(imported.path);
        }
    }

    return { firstPartyRequires, packageRequires };
}

function getDifferences(left, right) {
    return [...left].filter((value) => !right.has(value)).sort();
}

function validateRuntimeRequires(firstPartyRequires, packageRequires) {
    const issues = [];
    if (firstPartyRequires.length > 0) {
        issues.push(`First-party source emitted CommonJS runtime requires: ${firstPartyRequires.join(', ')}`);
    }

    const expectedPackages = new Set(Object.keys(expectedRuntimeRequires));
    const actualPackages = new Set(packageRequires.keys());
    const unexpectedPackages = getDifferences(actualPackages, expectedPackages);
    const stalePackages = getDifferences(expectedPackages, actualPackages);

    if (unexpectedPackages.length > 0) {
        issues.push(`Review and allowlist new bridge owners: ${unexpectedPackages.join(', ')}`);
    }
    if (stalePackages.length > 0) {
        issues.push(`Remove bridge owners that no longer require it: ${stalePackages.join(', ')}`);
    }

    for (const packageName of [...expectedPackages].filter((name) => actualPackages.has(name)).sort()) {
        const expectedTargets = new Set(expectedRuntimeRequires[packageName]);
        const actualTargets = packageRequires.get(packageName).targets;
        const addedTargets = getDifferences(actualTargets, expectedTargets);
        const removedTargets = getDifferences(expectedTargets, actualTargets);

        if (addedTargets.length > 0) {
            issues.push(`${packageName} added runtime requires: ${addedTargets.join(', ')}`);
        }
        if (removedTargets.length > 0) {
            issues.push(`${packageName} no longer requires: ${removedTargets.join(', ')}`);
        }
    }

    if (issues.length > 0) {
        throw new Error(`Bundle runtime require audit failed:\n- ${issues.join('\n- ')}`);
    }
}

function validateEsmOutput(metafile) {
    const output = Object.entries(metafile.outputs).find(([outputPath]) =>
        outputPath.replaceAll('\\', '/').endsWith('dist/extension.mjs')
    )?.[1];
    if (!output) {
        throw new Error('Bundle runtime require audit could not find dist/extension.mjs in the esbuild metafile.');
    }

    if (output.exports.length !== 1 || output.exports[0] !== 'activate') {
        throw new Error(`Expected the extension bundle to export only activate; found: ${output.exports.join(', ')}`);
    }

    if (!output.imports.some((imported) => imported.path === 'vscode' && imported.kind === 'import-statement')) {
        throw new Error('Expected the extension bundle to use a native ESM import for vscode.');
    }
}

export async function auditBundle(metafile, production) {
    if (!metafile) {
        throw new Error('Bundle runtime require audit requires an esbuild metafile.');
    }

    const { firstPartyRequires, packageRequires } = getRuntimeRequires(metafile);
    validateRuntimeRequires(firstPartyRequires, packageRequires);
    validateEsmOutput(metafile);

    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    const directDependencies = new Set(Object.keys(packageJson.dependencies));
    const packageNames = [...packageRequires.keys()].sort();
    const directOwners = packageNames.filter((name) => directDependencies.has(name));
    const transitiveOwners = packageNames.filter((name) => !directDependencies.has(name));
    const vscodeOwners = packageNames.filter((name) => packageRequires.get(name).targets.has('vscode'));
    const moduleCount = new Set([...packageRequires.values()].flatMap((record) => [...record.inputs])).size;
    const importCount = [...packageRequires.values()].reduce((count, record) => count + record.imports, 0);
    const mode = production ? 'production' : 'development';

    console.log(
        `[bundle-audit] ${mode}: ${packageNames.length} owners, ${moduleCount} modules, ${importCount} runtime requires`
    );
    console.log(`[bundle-audit] direct/component: ${directOwners.join(', ')}`);
    console.log(`[bundle-audit] transitive: ${transitiveOwners.join(', ')}`);
    console.log(`[bundle-audit] require("vscode"): ${vscodeOwners.join(', ')}`);
}

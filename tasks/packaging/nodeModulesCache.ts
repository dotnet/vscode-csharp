/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Node 24 runs this before npm dependencies have been installed.
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const os: typeof import('node:os') = require('node:os');
const { createHash }: typeof import('node:crypto') = require('node:crypto');

const rootPath = process.cwd();
const npmVersion = process.env.npm_config_user_agent?.match(/\bnpm\/(\S+)/)?.[1];
if (!npmVersion) {
    throw new Error('Run this task through npm run cacheNodeModules to identify the npm version.');
}

// Component versions are validated separately; all other manifest inputs can affect npm installation.
const { defaults: _defaults, ...manifest }: Record<string, unknown> = JSON.parse(
    fs.readFileSync(path.join(rootPath, 'package.json'), 'utf8')
);
const hash = createHash('sha256');
hash.update(
    JSON.stringify({
        platform: process.platform,
        architecture: process.arch,
        node: process.version,
        npm: npmVersion,
        operatingSystem: process.platform === 'linux' ? fs.readFileSync('/etc/os-release', 'utf8') : os.version(),
        nodeEnv: process.env.NODE_ENV,
        npmConfiguration: {
            omit: process.env.npm_config_omit,
            include: process.env.npm_config_include,
            ignoreScripts: process.env.npm_config_ignore_scripts,
            legacyPeerDeps: process.env.npm_config_legacy_peer_deps,
            installLinks: process.env.npm_config_install_links,
        },
        manifest,
    })
);
for (const file of ['package-lock.json', '.npmrc', 'tasks/packaging/nodeModulesCache.ts']) {
    hash.update(fs.readFileSync(path.join(rootPath, file)));
}

// Cache restoration overlays files, so do not allow an older installation to survive an exact hit.
const nodeModulesPath = path.join(rootPath, 'node_modules');
fs.rmSync(nodeModulesPath, { recursive: true, force: true });
fs.mkdirSync(nodeModulesPath);
console.log(`##vso[task.setvariable variable=NodeModulesCacheKey]${hash.digest('hex')}`);

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Node 24 runs this before npm dependencies have been installed.
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { createHash }: typeof import('node:crypto') = require('node:crypto');

const rootPath = process.cwd();
const npmVersion = process.env.npm_config_user_agent?.match(/\bnpm\/(\S+)/)?.[1];
if (!npmVersion) {
    throw new Error('Run this task through npm run cacheNodeModules to identify the npm version.');
}

const hash = createHash('sha256');
hash.update(
    JSON.stringify({
        platform: process.platform,
        architecture: process.arch,
        node: process.version,
        npm: npmVersion,
        operatingSystem: process.platform === 'linux' ? fs.readFileSync('/etc/os-release', 'utf8') : os.version(),
        keyVersion: 0, // Increment this value to force a cache rebuild
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

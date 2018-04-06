/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as debugUtil from '../src/coreclr-debug/util';
import * as del from 'del';
import * as fs from 'fs';
import * as gulp from 'gulp';
import * as path from 'path';
import * as unzip from 'unzip2';
import * as util from '../src/common';
import { offlineVscodeignorePath, onlineVscodeignorePath, rootPath, unpackedVsixPath, vscePath, vscodeignorePath } from './projectPaths';
import { CsharpLoggerObserver } from '../src/observers/CsharpLoggerObserver';
import { EventStream } from '../src/EventStream';
import { Logger } from '../src/logger';
import { PackageManager } from '../src/packages';
import { PlatformInformation } from '../src/platform';
import { getPackageJSON } from './packageJson';
import spawnNode from './spawnNode';

gulp.task('vsix:release:unpackage', () => {
    const packageJSON = getPackageJSON();
    const name = packageJSON.name;
    const version = packageJSON.version;
    const packageName = `${name}-${version}.vsix`;
    const packagePath = path.join(rootPath, packageName);

    del.sync(unpackedVsixPath);
    fs.createReadStream(packageName).pipe(unzip.Extract({ path: unpackedVsixPath }));
});

gulp.task('vsix:release:package', (onError) => {
    del.sync(vscodeignorePath);

    fs.copyFileSync(onlineVscodeignorePath, vscodeignorePath);

    return spawnNode([vscePath, 'package'])
        .then(() => {
            del(vscodeignorePath);
        }, (error) => {
            del(vscodeignorePath);
            throw error;
        });
});
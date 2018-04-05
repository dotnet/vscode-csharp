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
import spawnNode from './spawnNode';
import { getPackageJSON } from './packageJson';
import { unpackedVsixPath, rootPath, vscePath, vscodeignorePath, onlineVscodeignorePath, offlineVscodeignorePath } from './projectPaths';
import { PlatformInformation } from '../src/platform';
import { PackageManager } from '../src/packages';
import { EventStream } from '../src/EventStream';
import { CsharpLoggerObserver } from '../src/observers/CsharpLoggerObserver';
import { Logger } from '../src/logger';

gulp.task('vsix:online:unpackage', () => {
    const packageJSON = getPackageJSON();  
    const name = packageJSON.name; 
    const version = packageJSON.version;  
    const packageName = `${name}-${version}.vsix`;
    const packagePath = path.join(rootPath, packageName);

    del.sync(unpackedVsixPath);
    fs.createReadStream(packageName).pipe(unzip.Extract({ path: unpackedVsixPath }));
});

gulp.task('vsix:online:package', (onError) => {
    del.sync(vscodeignorePath);

    fs.copyFileSync(onlineVscodeignorePath, vscodeignorePath);

    let onDone = (reason) => {
        del(vscodeignorePath);
        onError(reason);
    };

    spawnNode(onDone, [vscePath, 'package']);
});
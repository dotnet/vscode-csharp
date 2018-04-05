/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as gulp from 'gulp';
import * as path from 'path';
import * as del from 'del';
import spawnNode from './spawnNode';
import { coverageRootPath, nycOutputPath, nycPath, codeExtensionSourcesPath } from './projectPaths';


// "cov:instrument": "cd ./vsix/extension/out && nyc instrument --require source-map-support/register --cwd ../ . . && cd ../../../",
gulp.task("cov:instrument", () => {
    del(coverageRootPath);
    del(nycOutputPath);

    return spawnNode([
        nycPath,
        'instrument',
        '--require',
        'source-map-support/register',
        '.',
        '.'
    ], {
        cwd: codeExtensionSourcesPath
    });
});

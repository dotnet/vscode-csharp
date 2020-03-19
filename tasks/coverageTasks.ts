/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as gulp from 'gulp';
import * as path from 'path';
import * as del from 'del';
import spawnNode from './spawnNode';
import { coverageRootPath, nycOutputPath, nycPath, codeExtensionSourcesPath, integrationTestCoverageRootPath, integrationTestNycOutputPath, istanbulPath, codecovPath, unitTestCoverageRootPath } from './projectPaths';

gulp.task("cov:instrument", async () => {
    del(coverageRootPath);
    del(nycOutputPath);

    return spawnNode([
        nycPath,
        'instrument',
        '--in-place',
        '--require',
        'source-map-support/register',
        '.',
        '.'
    ], {
        cwd: codeExtensionSourcesPath
    });
});

gulp.task("cov:merge", async () => {
    return spawnNode([
        istanbulPath,
        'report',
        '--dir',
        integrationTestCoverageRootPath,
        '--include',
        `${integrationTestNycOutputPath}/*.json`,
        'lcovonly'
    ], {
        cwd: codeExtensionSourcesPath
    });
});

gulp.task("cov:merge-html", async () => {
    return spawnNode([
        istanbulPath,
        'report',
        '--dir',
        integrationTestCoverageRootPath,
        '--include',
        `${integrationTestNycOutputPath}/*.json`,
        'html'
    ], {
        cwd: codeExtensionSourcesPath
    });
});


gulp.task("cov:report:integration", gulp.series("cov:merge", async () => {
    return spawnNode([
        codecovPath,
        '-f',
        path.join(integrationTestCoverageRootPath, 'lcov.info'),
        '-F',
        'integration'
    ], {
        cwd: codeExtensionSourcesPath
    });
}));

gulp.task("cov:report:unit", async () => {
    return spawnNode([
        codecovPath,
        '-f',
        path.join(unitTestCoverageRootPath, 'lcov.info'),
        '-F',
        'unit'
    ], {
        cwd: codeExtensionSourcesPath
    });
});

gulp.task("cov:report", gulp.parallel("cov:report:integration", "cov:report:unit"));

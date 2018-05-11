/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as gulp from 'gulp';
import * as path from 'path';
import * as del from 'del';
import spawnNode from './spawnNode';
import { coverageRootPath, nycOutputPath, nycPath, codeExtensionSourcesPath, integrationTestCoverageRootPath, integrationTestNycOutputPath, istanbulCombinePath, codecovPath, unitTestCoverageRootPath, featureTestCoverageRootPath } from './projectPaths';

gulp.task("cov:instrument", async () => {
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

gulp.task("cov:merge", async () => {
    return spawnNode([
        istanbulCombinePath,
        '-d',
        integrationTestCoverageRootPath,
        '-r',
        'lcovonly',
        `${integrationTestNycOutputPath}/*.json`
    ], {
        cwd: codeExtensionSourcesPath
    });
});

gulp.task("cov:merge-html", async () => {
    return spawnNode([
        istanbulCombinePath,
        '-d',
        integrationTestCoverageRootPath,
        '-r',
        'html',
        `${integrationTestNycOutputPath}/*.json`
    ], {
        cwd: codeExtensionSourcesPath
    });
});

gulp.task("cov:report", ["cov:report:integration", "cov:report:unit", "cov:report:feature"]);

gulp.task("cov:report:integration", ["cov:merge"], async () => {
    return spawnNode([
        codecovPath,
        '-f',
        path.join(integrationTestCoverageRootPath, 'lcov.info'),
        '-F',
        'integration'
    ], {
        cwd: codeExtensionSourcesPath
    });
});

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

gulp.task("cov:report:feature", async () => {
    return spawnNode([
        codecovPath,
        '-f',
        path.join(featureTestCoverageRootPath, 'lcov.info'),
        '-F',
        'feature'
    ], {
        cwd: codeExtensionSourcesPath
    });
});

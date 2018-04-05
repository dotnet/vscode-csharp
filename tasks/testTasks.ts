/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as gulp from 'gulp';
import * as path from 'path';

import { codeExtensionPath, nodePath, nycPath, rootPath, runnerPath, testAssetsRootPath, testRootPath, unitTestCoverageRootPath } from './projectPaths';
import { execFile, spawn } from 'child_process';

import spawnNode from './spawnNode';

const gulpSequence = require('gulp-sequence');

gulp.task("test", gulpSequence(
    "test:feature",
    "test:unit",
    "test:integration"));

gulp.task("test:feature", () => {
    let env = {
        ...process.env,
        OSVC_SUITE: "featureTests",
        CODE_TESTS_PATH: path.join(testRootPath, "featureTests")
    };

    return spawnNode([runnerPath], {
        env
    });
});

gulp.task("test:unit", () => {
    return spawnNode([
        nycPath,
        '-r',
        'lcovonly',
        '--report-dir',
        unitTestCoverageRootPath,
        'mocha',
        '--ui',
        'tdd',
        '--',
        'test/unitTests/**/*.test.ts'
    ]);
});

gulp.task(
    "test:integration", gulpSequence(
        "test:integration:singleCsproj",
        "test:integration:slnWithCsproj"
    ));

gulp.task("test:integration:singleCsproj", () => {
    return runIntegrationTest("singleCsproj");
});

gulp.task("test:integration:slnWithCsproj", () => {
    return runIntegrationTest("slnWithCsproj");
});

function runIntegrationTest(testAssetName: string) {
    let env = {
        OSVC_SUITE: testAssetName,
        CODE_TESTS_PATH: path.join(testRootPath, "integrationTests"),
        CODE_EXTENSIONS_PATH: codeExtensionPath,
        CODE_TESTS_WORKSPACE: path.join(testAssetsRootPath, testAssetName),
        CODE_WORKSPACE_ROOT: rootPath,
    };

    return spawnNode([runnerPath], { env, cwd: rootPath });
}
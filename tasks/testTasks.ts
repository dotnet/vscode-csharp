/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as gulp from 'gulp';
import * as path from 'path';
import { codeExtensionPath, nycPath, rootPath, testAssetsRootPath, testRootPath, unitTestCoverageRootPath, mochaPath, vscodeTestHostPath } from './projectPaths';
import spawnNode from './spawnNode';

gulp.task("test:feature", async () => {
    let env = {
        ...process.env,
        OSVC_SUITE: "featureTests",
        CODE_TESTS_PATH: path.join(testRootPath, "featureTests")
    };

    return spawnNode([vscodeTestHostPath, "--verbose"], {
        env
    });
});

gulp.task("test:unit", async () => {
    return spawnNode([
        nycPath,
        '-r',
        'lcovonly',
        '--report-dir',
        unitTestCoverageRootPath,
        mochaPath,
        '--ui',
        'tdd',
        '--',
        'test/unitTests/**/*.test.ts'
    ]);
});

gulp.task("test:integration:singleCsproj", async () => {
    return runIntegrationTest("singleCsproj");
});

gulp.task("test:integration:slnWithCsproj", async () => {
    return runIntegrationTest("slnWithCsproj");
});

gulp.task("test:integration:BasicRazorApp2_1", async () => {
    return runIntegrationTest("BasicRazorApp2_1");
});

gulp.task(
    "test:integration", gulp.series(
        "test:integration:singleCsproj",
        "test:integration:slnWithCsproj",
        "test:integration:BasicRazorApp2_1"
    ));

gulp.task("test", gulp.series(
    "test:feature",
    "test:unit",
    "test:integration"));

async function runIntegrationTest(testAssetName: string) {
    let env = {
        OSVC_SUITE: testAssetName,
        CODE_TESTS_PATH: path.join(testRootPath, "integrationTests"),
        CODE_EXTENSIONS_PATH: codeExtensionPath,
        CODE_TESTS_WORKSPACE: path.join(testAssetsRootPath, testAssetName),
        CODE_WORKSPACE_ROOT: rootPath,
    };

    return spawnNode([vscodeTestHostPath], { env, cwd: rootPath });
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as path from 'path';
import { codeExtensionPath, featureTestRunnerPath, integrationTestRunnerPath, mochaPath, rootPath, testAssetsRootPath, testRootPath } from './projectPaths';
import spawnNode from './spawnNode';

gulp.task("test:feature", async () => {
    let env = {
        OSVC_SUITE: "featureTests",
        CODE_EXTENSIONS_PATH: codeExtensionPath,
        CODE_TESTS_PATH: path.join(testRootPath, "featureTests"),
        CODE_WORKSPACE_ROOT: rootPath,
    };

    return spawnNode([featureTestRunnerPath], { env });
});

gulp.task("test:unit", async () => {
    return spawnNode([
        mochaPath,
        '--ui',
        'tdd',
        '-c',
        'test/unitTests/**/*.test.ts'
    ]);
});

gulp.task("test:integration:singleCsproj", async () => {
    return runIntegrationTest("singleCsproj");
});

gulp.task("test:integration:slnWithCsproj", async () => {
    return runIntegrationTest("slnWithCsproj");
});

gulp.task("test:integration:slnFilterWithCsproj", async () => {
    return runIntegrationTest("slnFilterWithCsproj");
});

gulp.task("test:integration:BasicRazorApp2_1", async () => {
    return runIntegrationTest("BasicRazorApp2_1");
});

gulp.task(
    "test:integration", gulp.series(
        "test:integration:singleCsproj",
        "test:integration:slnWithCsproj",
        "test:integration:slnFilterWithCsproj",
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

    const result = await spawnNode([integrationTestRunnerPath], { env, cwd: rootPath });

    if (result.code > 0) {
        // Ensure that gulp fails when tests fail
        throw new Error(`Exit code: ${result.code}  Signal: ${result.signal}`);
    }

    return result;
}

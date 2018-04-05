/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as gulp from 'gulp';
import * as path from 'path';
import { execFile, spawn } from 'child_process';
import { testRootPath, nodePath, runnerPath, unpackedExtensionPath, testAssetsRootPath, rootPath } from './projectPaths';
import spawnNode from './spawnNode';

gulp.task("test", ["test:feature", "test:integration"], () => {

});

gulp.task(
    "test:integration", [
        "test:integration:singleCsproj",
        "test:integration:slnWithCsproj"
    ], () => {
});

gulp.task("test:integration:singleCsproj", () => {
    return runIntegrationTest("singleCsproj");
});

gulp.task("test:integration:slnWithCsproj", () => {
    return runIntegrationTest("slnWithCsproj");
});

gulp.task("test:feature", () => {
    let env = {
        ...process.env,
        OSVC_SUITE: "featureTests",
        CODE_TESTS_PATH: path.join(testRootPath, "featureTests")
    };

    return spawnNode([ runnerPath ], {
        env
    });
});

function runIntegrationTest(testAssetName: string) {
    let env = {
        OSVC_SUITE: testAssetName,
        CODE_TESTS_PATH: path.join(testRootPath, "integrationTests"),
        CODE_EXTENSIONS_PATH: unpackedExtensionPath,
        CODE_TESTS_WORKSPACE: path.join(testAssetsRootPath, testAssetName),
        CODE_WORKSPACE_ROOT: rootPath,
    };

    return spawnNode([runnerPath], { env, cwd: rootPath});
}
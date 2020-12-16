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
        CODE_TESTS_PATH: path.join(testRootPath, "featureTests"),
        // CODE_DISABLE_EXTENSIONS: "true",
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

const projectNames = [
    "singleCsproj",
    "slnWithCsproj",
    "BasicRazorApp2_1"
];

for (const projectName of projectNames) {
    gulp.task(`test:integration:${projectName}:stdio`, () => runIntegrationTest(projectName, 'stdio'));
    gulp.task(`test:integration:${projectName}:lsp`, () => runIntegrationTest(projectName, 'lsp'));
    gulp.task(`test:integration:${projectName}`, gulp.series(`test:integration:${projectName}:stdio`, `test:integration:${projectName}:lsp`));
}


gulp.task("test:integration", gulp.series(projectNames.map(projectName => `test:integration:${projectName}`)));
gulp.task("test:integration:stdio", gulp.series(projectNames.map(projectName => `test:integration:${projectName}:lsp`)));
gulp.task("test:integration:lsp", gulp.series(projectNames.map(projectName => `test:integration:${projectName}:stdio`)));
gulp.task("test", gulp.series("test:feature", "test:unit", "test:integration"));

async function runIntegrationTest(testAssetName: string, driver: 'stdio' | 'lsp') {
    let env = {
        OSVC_SUITE: testAssetName,
        CODE_TESTS_PATH: path.join(testRootPath, "integrationTests"),
        CODE_EXTENSIONS_PATH: codeExtensionPath,
        CODE_TESTS_WORKSPACE: path.join(testAssetsRootPath, testAssetName),
        CODE_WORKSPACE_ROOT: rootPath,
        OMNISHARP_DRIVER: driver,
        OMNISHARP_LOCATION: process.env.OMNISHARP_LOCATION,
        CODE_DISABLE_EXTENSIONS: 'true',
    };

    return spawnNode([vscodeTestHostPath], { env, cwd: rootPath });
}

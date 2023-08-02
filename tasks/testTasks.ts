/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as path from 'path';
import {
    codeExtensionPath,
    featureTestRunnerPath,
    integrationTestRunnerPath,
    mochaPath,
    rootPath,
    testAssetsRootPath,
    testRootPath,
} from './projectPaths';
import spawnNode from './spawnNode';

gulp.task('test:feature', async () => {
    const env = {
        OSVC_SUITE: 'featureTests',
        CODE_EXTENSIONS_PATH: codeExtensionPath,
        CODE_TESTS_PATH: path.join(testRootPath, 'featureTests'),
        CODE_WORKSPACE_ROOT: rootPath,
        CODE_DISABLE_EXTENSIONS: 'true',
    };

    const result = await spawnNode([featureTestRunnerPath], { env });

    if (result.code === null || result.code > 0) {
        // Ensure that gulp fails when tests fail
        throw new Error(`Exit code: ${result.code}  Signal: ${result.signal}`);
    }

    return result;
});

gulp.task('test:unit', async () => {
    const result = await spawnNode([mochaPath, '--ui', 'tdd', '-c', 'out/test/unitTests/**/*.test.js']);

    if (result.code === null || result.code > 0) {
        // Ensure that gulp fails when tests fail
        throw new Error(`Exit code: ${result.code}  Signal: ${result.signal}`);
    }

    return result;
});

const projectNames = ['singleCsproj', 'slnWithCsproj', 'slnFilterWithCsproj', 'BasicRazorApp2_1'];

for (const projectName of projectNames) {
    gulp.task(`test:integration:${projectName}:stdio`, async () => runIntegrationTest(projectName, 'stdio'));
    gulp.task(`test:integration:${projectName}:lsp`, async () => runIntegrationTest(projectName, 'lsp'));
    gulp.task(
        `test:integration:${projectName}`,
        gulp.series(`test:integration:${projectName}:stdio`, `test:integration:${projectName}:lsp`)
    );
}

gulp.task('test:integration', gulp.series(projectNames.map((projectName) => `test:integration:${projectName}`)));
gulp.task(
    'test:integration:stdio',
    gulp.series(projectNames.map((projectName) => `test:integration:${projectName}:stdio`))
);
gulp.task(
    'test:integration:lsp',
    gulp.series(projectNames.map((projectName) => `test:integration:${projectName}:lsp`))
);
// TODO: Enable lsp integration tests once tests for unimplemented features are disabled.
gulp.task('test', gulp.series('test:feature', 'test:unit', 'test:integration:stdio'));

async function runIntegrationTest(testAssetName: string, engine: 'stdio' | 'lsp') {
    const env = {
        OSVC_SUITE: testAssetName,
        CODE_TESTS_PATH: path.join(testRootPath, 'integrationTests'),
        CODE_EXTENSIONS_PATH: codeExtensionPath,
        CODE_TESTS_WORKSPACE: path.join(testAssetsRootPath, testAssetName),
        CODE_WORKSPACE_ROOT: rootPath,
        OMNISHARP_ENGINE: engine,
        OMNISHARP_LOCATION: process.env.OMNISHARP_LOCATION,
        CODE_DISABLE_EXTENSIONS: 'true',
    };

    const result = await spawnNode([integrationTestRunnerPath, '--enable-source-maps'], { env, cwd: rootPath });

    if (result.code === null || result.code > 0) {
        // Ensure that gulp fails when tests fail
        throw new Error(`Exit code: ${result.code}  Signal: ${result.signal}`);
    }

    return result;
}

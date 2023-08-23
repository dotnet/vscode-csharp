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
    jestPath,
    mochaPath,
    rootPath,
    testAssetsRootPath,
    testRootPath,
} from './projectPaths';
import spawnNode from './spawnNode';

gulp.task('omnisharptest:feature', async () => {
    const env = {
        OSVC_SUITE: 'omnisharpFeatureTests',
        CODE_EXTENSIONS_PATH: codeExtensionPath,
        CODE_TESTS_PATH: path.join(testRootPath, 'omnisharpFeatureTests'),
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

gulp.task('omnisharptest:unit', async () => {
    const result = await spawnNode([
        mochaPath,
        '--ui',
        'tdd',
        '-c',
        'out/omnisharptest/omnisharpUnitTests/**/*.test.js',
    ]);

    if (result.code === null || result.code > 0) {
        // Ensure that gulp fails when tests fail
        throw new Error(`Exit code: ${result.code}  Signal: ${result.signal}`);
    }

    return result;
});

gulp.task('omnisharp:jest:test', async () => {
    runJestTest(/.*omnisharpJestTests.*/);
});

const projectNames = ['singleCsproj', 'slnWithCsproj', 'slnFilterWithCsproj', 'BasicRazorApp2_1'];

for (const projectName of projectNames) {
    gulp.task(`omnisharptest:integration:${projectName}:stdio`, async () => runIntegrationTest(projectName, 'stdio'));
    gulp.task(`omnisharptest:integration:${projectName}:lsp`, async () => runIntegrationTest(projectName, 'lsp'));
    gulp.task(
        `omnisharptest:integration:${projectName}`,
        gulp.series(`omnisharptest:integration:${projectName}:stdio`, `omnisharptest:integration:${projectName}:lsp`)
    );
}

gulp.task(
    'omnisharptest:integration',
    gulp.series(projectNames.map((projectName) => `omnisharptest:integration:${projectName}`))
);
gulp.task(
    'omnisharptest:integration:stdio',
    gulp.series(projectNames.map((projectName) => `omnisharptest:integration:${projectName}:stdio`))
);
gulp.task(
    'omnisharptest:integration:lsp',
    gulp.series(projectNames.map((projectName) => `omnisharptest:integration:${projectName}:lsp`))
);
// TODO: Enable lsp integration tests once tests for unimplemented features are disabled.
gulp.task(
    'omnisharptest',
    gulp.series('omnisharp:jest:test', 'omnisharptest:feature', 'omnisharptest:unit', 'omnisharptest:integration:stdio')
);

gulp.task('test:unit', async () => {
    runJestTest(/unitTests.*\.ts/);
});

gulp.task('test', gulp.series('test:unit'));

async function runIntegrationTest(testAssetName: string, engine: 'stdio' | 'lsp') {
    const env = {
        OSVC_SUITE: testAssetName,
        CODE_TESTS_PATH: path.join(testRootPath, 'omnisharpIntegrationTests'),
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

async function runJestTest(testFilterRegex: RegExp) {
    const result = await spawnNode([jestPath, testFilterRegex.source]);

    if (result.code === null || result.code > 0) {
        // Ensure that gulp fails when tests fail
        throw new Error(`Exit code: ${result.code}  Signal: ${result.signal}`);
    }

    return result;
}

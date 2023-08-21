/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as path from 'path';
import {
    codeExtensionPath,
    omnisharpFeatureTestRunnerPath,
    omnisharpIntegrationTestRunnerPath,
    mochaPath,
    rootPath,
    omnisharpTestAssetsRootPath,
    omnisharpTestRootPath,
    testRootPath,
    integrationTestRunnerPath,
} from './projectPaths';
import spawnNode from './spawnNode';

gulp.task('omnisharptest:feature', async () => {
    const env = {
        OSVC_SUITE: 'omnisharpFeatureTests',
        CODE_EXTENSIONS_PATH: codeExtensionPath,
        CODE_TESTS_PATH: path.join(omnisharpTestRootPath, 'omnisharpFeatureTests'),
        CODE_WORKSPACE_ROOT: rootPath,
        CODE_DISABLE_EXTENSIONS: 'true',
    };

    const result = await spawnNode([omnisharpFeatureTestRunnerPath], { env });

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

const projectNames = ['singleCsproj', 'slnWithCsproj', 'slnFilterWithCsproj', 'BasicRazorApp2_1'];

for (const projectName of projectNames) {
    gulp.task(`omnisharptest:integration:${projectName}:stdio`, async () =>
        runOmnisharpIntegrationTest(projectName, 'stdio')
    );
    gulp.task(`omnisharptest:integration:${projectName}:lsp`, async () =>
        runOmnisharpIntegrationTest(projectName, 'lsp')
    );
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
    gulp.series('omnisharptest:feature', 'omnisharptest:unit', 'omnisharptest:integration:stdio')
);

gulp.task('test:integration:slnWithCsproj', async () => runIntegrationTest('slnWithCsproj'));

async function runOmnisharpIntegrationTest(testAssetName: string, engine: 'stdio' | 'lsp') {
    let workspacePath: string;
    if (engine === 'lsp') {
        workspacePath = path.join(
            omnisharpTestAssetsRootPath,
            testAssetName,
            '.vscode',
            `omnisharp_${engine}_${testAssetName}.code-workspace`
        );
    } else {
        workspacePath = path.join(
            omnisharpTestAssetsRootPath,
            testAssetName,
            '.vscode',
            `omnisharp_${testAssetName}.code-workspace`
        );
    }

    const env = {
        OSVC_SUITE: testAssetName,
        CODE_TESTS_PATH: path.join(omnisharpTestRootPath, 'omnisharpIntegrationTests'),
        CODE_EXTENSIONS_PATH: codeExtensionPath,
        CODE_TESTS_WORKSPACE: workspacePath,
        CODE_WORKSPACE_ROOT: rootPath,
        OMNISHARP_ENGINE: engine,
        OMNISHARP_LOCATION: process.env.OMNISHARP_LOCATION,
        CODE_DISABLE_EXTENSIONS: 'true',
    };

    const result = await spawnNode([omnisharpIntegrationTestRunnerPath, '--enable-source-maps'], {
        env,
        cwd: rootPath,
    });

    if (result.code === null || result.code > 0) {
        // Ensure that gulp fails when tests fail
        throw new Error(`Exit code: ${result.code}  Signal: ${result.signal}`);
    }

    return result;
}

async function runIntegrationTest(testAssetName: string) {
    const env = {
        OSVC_SUITE: testAssetName,
        CODE_TESTS_PATH: path.join(testRootPath, 'integrationTests'),
        CODE_EXTENSIONS_PATH: codeExtensionPath,
        CODE_TESTS_WORKSPACE: path.join(omnisharpTestAssetsRootPath, testAssetName),
        CODE_WORKSPACE_ROOT: rootPath,
        CODE_DISABLE_EXTENSIONS: 'true',
    };

    const result = await spawnNode([integrationTestRunnerPath, '--enable-source-maps'], { env, cwd: rootPath });

    if (result.code === null || result.code > 0) {
        // Ensure that gulp fails when tests fail
        throw new Error(`Exit code: ${result.code}  Signal: ${result.signal}`);
    }

    return result;
}

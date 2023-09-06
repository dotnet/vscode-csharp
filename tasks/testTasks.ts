/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as gulp from 'gulp';
import * as path from 'path';
import {
    codeExtensionPath,
    omnisharpFeatureTestRunnerPath,
    mochaPath,
    rootPath,
    omnisharpTestAssetsRootPath,
    omnisharpTestRootPath,
    testRootPath,
    integrationTestRunnerPath,
} from './projectPaths';
import spawnNode from './spawnNode';
import * as jest from 'jest';
import { Config } from '@jest/types';
import { jestOmniSharpUnitTestProjectName } from '../omnisharptest/omnisharpJestTests/jest.config';
import { jestUnitTestProjectName } from '../test/unitTests/jest.config';
import { razorTestProjectName } from '../test/razorTests/jest.config';

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

gulp.task('test:razor', async () => {
    runJestTest(razorTestProjectName);
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
    runJestTest(jestOmniSharpUnitTestProjectName);
});

const omnisharpIntegrationTestProjects = ['singleCsproj', 'slnWithCsproj', 'slnFilterWithCsproj', 'BasicRazorApp2_1'];

for (const projectName of omnisharpIntegrationTestProjects) {
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
    gulp.series(omnisharpIntegrationTestProjects.map((projectName) => `omnisharptest:integration:${projectName}`))
);
gulp.task(
    'omnisharptest:integration:stdio',
    gulp.series(omnisharpIntegrationTestProjects.map((projectName) => `omnisharptest:integration:${projectName}:stdio`))
);
gulp.task(
    'omnisharptest:integration:lsp',
    gulp.series(omnisharpIntegrationTestProjects.map((projectName) => `omnisharptest:integration:${projectName}:lsp`))
);
// TODO: Enable lsp integration tests once tests for unimplemented features are disabled.
gulp.task(
    'omnisharptest',
    gulp.series(
        'omnisharp:jest:test',
        'omnisharptest:feature',
        'omnisharptest:unit',
        'omnisharptest:integration:stdio'
    )
);

gulp.task('test:unit', async () => {
    await runJestTest(jestUnitTestProjectName);
});

const integrationTestProjects = ['slnWithCsproj'];
for (const projectName of integrationTestProjects) {
    gulp.task(`test:integration:${projectName}`, async () => runIntegrationTest(projectName));
}

gulp.task(
    'test:integration',
    gulp.series(integrationTestProjects.map((projectName) => `test:integration:${projectName}`))
);

gulp.task('test', gulp.series('test:unit', 'test:integration', 'test:razor'));

async function runOmnisharpIntegrationTest(testAssetName: string, engine: 'stdio' | 'lsp') {
    const workspaceFile = `omnisharp${engine === 'lsp' ? '_lsp' : ''}_${testAssetName}.code-workspace`;
    const workspacePath = path.join(omnisharpTestAssetsRootPath, testAssetName, '.vscode', workspaceFile);
    const codeTestsPath = path.join(omnisharpTestRootPath, 'omnisharpIntegrationTests');

    const env = {
        OSVC_SUITE: testAssetName,
        CODE_TESTS_PATH: codeTestsPath,
        CODE_EXTENSIONS_PATH: codeExtensionPath,
        CODE_TESTS_WORKSPACE: workspacePath,
        CODE_WORKSPACE_ROOT: rootPath,
        EXTENSIONS_TESTS_PATH: path.join(codeTestsPath, 'index.js'),
        OMNISHARP_ENGINE: engine,
        OMNISHARP_LOCATION: process.env.OMNISHARP_LOCATION,
        CODE_DISABLE_EXTENSIONS: 'true',
    };

    const result = await spawnNode([integrationTestRunnerPath, '--enable-source-maps'], {
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
    const workspacePath = path.join(
        omnisharpTestAssetsRootPath,
        testAssetName,
        '.vscode',
        `lsp_tools_host_${testAssetName}.code-workspace`
    );
    const codeTestsPath = path.join(testRootPath, 'integrationTests');

    const env = {
        CODE_TESTS_WORKSPACE: workspacePath,
        CODE_EXTENSIONS_PATH: rootPath,
        EXTENSIONS_TESTS_PATH: path.join(codeTestsPath, 'index.js'),
    };

    const result = await spawnNode([integrationTestRunnerPath, '--enable-source-maps'], { env, cwd: rootPath });

    if (result.code === null || result.code > 0) {
        // Ensure that gulp fails when tests fail
        throw new Error(`Exit code: ${result.code}  Signal: ${result.signal}`);
    }

    return result;
}

async function runJestTest(project: string) {
    const configPath = path.join(rootPath, 'jest.config.ts');
    const { results } = await jest.runCLI(
        {
            config: configPath,
            selectProjects: [project],
            verbose: true,
        } as Config.Argv,
        [project]
    );

    if (!results.success) {
        throw new Error('Tests failed.');
    }
}

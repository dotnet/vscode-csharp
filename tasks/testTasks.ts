/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as gulp from 'gulp';
import * as path from 'path';
import { codeExtensionPath, rootPath, outPath } from './projectPaths';
import * as jest from 'jest';
import { Config } from '@jest/types';
import { jestOmniSharpUnitTestProjectName } from '../test/omnisharp/omnisharpUnitTests/jest.config';
import { jestUnitTestProjectName } from '../test/lsptoolshost/unitTests/jest.config';
import { razorTestProjectName } from '../test/razor/razorTests/jest.config';
import { jestArtifactTestsProjectName } from '../test/lsptoolshost/artifactTests/jest.config';
import { prepareVSCodeAndExecuteTests } from '../test/vscodeLauncher';

createUnitTestSubTasks();
createIntegrationTestSubTasks();
createOmniSharpTestSubTasks();

gulp.task('test:artifacts', async () => {
    runJestTest(jestArtifactTestsProjectName);
});

// Overall test command that runs everything except O# tests.
gulp.task('test', gulp.series('test:unit', 'test:integration'));

// Bit of a special task for CI.  We want to generally combine test runs to save preparation time.
// However the Dev Kit integration tests are much slower than everything else (VSCode restarts on each test file).
// So we can have one run for all of the general C# extension tests, and then another for Dev Kit integration tests.
gulp.task('test:withoutDevKit', gulp.series('test:unit', 'test:integration:csharp', 'test:razorintegration'));

gulp.task('test:razor', gulp.series('test:unit:razor', 'test:razorintegration'));

// OmniSharp tests are run separately in CI, so we have separate tasks for these.
// TODO: Enable lsp integration tests once tests for unimplemented features are disabled.
gulp.task('omnisharptest', gulp.series('omnisharptest:unit', 'omnisharptest:integration:stdio'));

function createUnitTestSubTasks() {
    gulp.task('test:unit:csharp', async () => {
        await runJestTest(jestUnitTestProjectName);
    });

    gulp.task('test:unit:razor', async () => {
        runJestTest(razorTestProjectName);
    });

    gulp.task('test:unit', gulp.series('test:unit:csharp', 'test:unit:razor'));
}

async function createIntegrationTestSubTasks() {
    const integrationTestProjects = ['slnWithCsproj'];
    for (const projectName of integrationTestProjects) {
        gulp.task(`test:integration:csharp:${projectName}`, async () =>
            runIntegrationTest(projectName, path.join('lsptoolshost', 'integrationTests'), `[C#][${projectName}]`)
        );

        gulp.task(`test:integration:devkit:${projectName}`, async () =>
            runDevKitIntegrationTests(
                projectName,
                path.join('lsptoolshost', 'integrationTests'),
                `[DevKit][${projectName}]`
            )
        );
    }

    gulp.task(
        'test:integration:csharp',
        gulp.series(integrationTestProjects.map((projectName) => `test:integration:csharp:${projectName}`))
    );

    gulp.task(
        'test:integration:devkit',
        gulp.series(integrationTestProjects.map((projectName) => `test:integration:devkit:${projectName}`))
    );

    const razorIntegrationTestProjects = ['BasicRazorApp2_1'];
    for (const projectName of razorIntegrationTestProjects) {
        gulp.task(`test:razorintegration:${projectName}`, async () =>
            runIntegrationTest(
                projectName,
                path.join('razor', 'razorIntegrationTests'),
                `Razor Test Integration ${projectName}`
            )
        );
    }

    gulp.task(
        'test:razorintegration',
        gulp.series(razorIntegrationTestProjects.map((projectName) => `test:razorintegration:${projectName}`))
    );

    gulp.task(
        'test:integration',
        gulp.series('test:integration:csharp', 'test:integration:devkit', 'test:razorintegration')
    );
}

function createOmniSharpTestSubTasks() {
    gulp.task('omnisharptest:unit', async () => {
        await runJestTest(jestOmniSharpUnitTestProjectName);
    });

    const omnisharpIntegrationTestProjects = [
        'singleCsproj',
        'slnWithCsproj',
        'slnFilterWithCsproj',
        'BasicRazorApp2_1',
    ];

    for (const projectName of omnisharpIntegrationTestProjects) {
        gulp.task(`omnisharptest:integration:${projectName}:stdio`, async () =>
            runOmnisharpJestIntegrationTest(projectName, 'stdio', `[O#][${projectName}][STDIO]`)
        );
        gulp.task(`omnisharptest:integration:${projectName}:lsp`, async () =>
            runOmnisharpJestIntegrationTest(projectName, 'lsp', `[O#][${projectName}][LSP]`)
        );
        gulp.task(
            `omnisharptest:integration:${projectName}`,
            gulp.series(
                `omnisharptest:integration:${projectName}:stdio`,
                `omnisharptest:integration:${projectName}:lsp`
            )
        );
    }

    gulp.task(
        'omnisharptest:integration',
        gulp.series(omnisharpIntegrationTestProjects.map((projectName) => `omnisharptest:integration:${projectName}`))
    );
    gulp.task(
        'omnisharptest:integration:stdio',
        gulp.series(
            omnisharpIntegrationTestProjects.map((projectName) => `omnisharptest:integration:${projectName}:stdio`)
        )
    );
    gulp.task(
        'omnisharptest:integration:lsp',
        gulp.series(
            omnisharpIntegrationTestProjects.map((projectName) => `omnisharptest:integration:${projectName}:lsp`)
        )
    );
}

async function runOmnisharpJestIntegrationTest(testAssetName: string, engine: 'stdio' | 'lsp', suiteName: string) {
    const workspaceFile = `omnisharp${engine === 'lsp' ? '_lsp' : ''}_${testAssetName}.code-workspace`;
    const testFolder = path.join('test', 'omnisharp', 'omnisharpIntegrationTests');

    const env = {
        OSVC_SUITE: testAssetName,
        CODE_EXTENSIONS_PATH: codeExtensionPath,
        CODE_WORKSPACE_ROOT: rootPath,
        OMNISHARP_ENGINE: engine,
        OMNISHARP_LOCATION: process.env.OMNISHARP_LOCATION,
        CODE_DISABLE_EXTENSIONS: 'true',
    };

    await runJestIntegrationTest(testAssetName, testFolder, workspaceFile, suiteName, env);
}

async function runDevKitIntegrationTests(testAssetName: string, testFolderName: string, suiteName: string) {
    // Tests using C# Dev Kit tests are a bit different from the rest - we are not able to restart the Dev Kit server and there
    // are not easy APIs to use to know if the project is reloading due to workspace changes.
    // So we have to isolate the C# Dev Kit tests into smaller test runs (in this case, per file), where each run
    // launches VSCode and runs the tests in that file.
    const testFolder = path.join(rootPath, 'test', testFolderName);
    console.log(`Searching for test files in ${testFolder}`);
    const allFiles = fs
        .readdirSync(testFolder, {
            recursive: true,
        })
        .filter((f) => typeof f === 'string');
    const devKitTestFiles = allFiles.filter((f) => f.endsWith('.test.ts')).map((f) => path.join(testFolder, f));
    if (devKitTestFiles.length === 0) {
        throw new Error(`No test files found in ${testFolder}`);
    }

    let failed: boolean = false;
    for (const testFile of devKitTestFiles) {
        try {
            await runIntegrationTest(
                testAssetName,
                testFolderName,
                suiteName,
                `devkit_${testAssetName}.code-workspace`,
                testFile
            );
        } catch (err) {
            // We have to catch the error to continue running tests from the rest of the files.
            console.error(`##[error] Tests in ${path.basename(testFile)} failed`, err);
            failed = true;
        }
    }

    if (failed) {
        // Ensure the task fails if any tests failed.
        throw new Error(`One or more tests failed`);
    }
}

async function runIntegrationTest(
    testAssetName: string,
    testFolderName: string,
    suiteName: string,
    vscodeWorkspaceFileName = `${testAssetName}.code-workspace`,
    testFile: string | undefined = undefined
) {
    const testFolder = path.join('test', testFolderName);
    const env: NodeJS.ProcessEnv = {};
    return await runJestIntegrationTest(testAssetName, testFolder, vscodeWorkspaceFileName, suiteName, env, testFile);
}

/**
 * Runs jest based integration tests.
 * @param testAssetName the name of the test asset
 * @param testFolderName the relative path (from workspace root)
 * @param workspaceFileName the name of the vscode workspace file to use.
 * @param suiteName a unique name for the test suite being run.
 * @param env any environment variables needed.
 * @param testFile the full path to a specific test file to run.
 */
async function runJestIntegrationTest(
    testAssetName: string,
    testFolderName: string,
    workspaceFileName: string,
    suiteName: string,
    env: NodeJS.ProcessEnv = {},
    testFile: string | undefined = undefined
) {
    const logName = testFile ? `${suiteName}_${path.basename(testFile)}` : suiteName;

    // Set VSCode to produce logs in a unique directory for this test run.
    const userDataDir = path.join(outPath, 'userData', logName);

    // Test assets are always in a testAssets folder inside the integration test folder.
    const assetsPath = path.join(rootPath, testFolderName, 'testAssets');
    if (!fs.existsSync(assetsPath)) {
        throw new Error(`Could not find test assets at ${assetsPath}`);
    }
    const workspacePath = path.join(assetsPath, testAssetName, '.vscode', workspaceFileName);
    if (!fs.existsSync(workspacePath)) {
        throw new Error(`Could not find vscode workspace to open at ${workspacePath}`);
    }

    // The runner (that loads in the vscode process to run tests) is in the test folder in the *output* directory.
    const vscodeRunnerPath = path.join(outPath, testFolderName, 'index.js');
    if (!fs.existsSync(vscodeRunnerPath)) {
        throw new Error(`Could not find vscode runner in out/ at ${vscodeRunnerPath}`);
    }

    // Configure the file and suite name in CI to avoid having multiple test runs stomp on each other.
    env.JEST_JUNIT_OUTPUT_NAME = getJUnitFileName(logName);
    env.JEST_SUITE_NAME = suiteName;

    if (testFile) {
        console.log(`Setting test file filter to: ${testFile}`);
        process.env.TEST_FILE_FILTER = testFile;
    }

    try {
        const result = await prepareVSCodeAndExecuteTests(rootPath, vscodeRunnerPath, workspacePath, userDataDir, env);
        if (result > 0) {
            // The VSCode API will generally throw if jest fails the test, but we can get errors before the test runs (e.g. launching VSCode).
            // So here we make sure to error if we don't get a clean exit code.
            throw new Error(`Exit code: ${result}`);
        }

        return result;
    } finally {
        // Copy the logs VSCode produced to the output log directory
        const vscodeLogs = path.join(userDataDir, 'logs');
        const logOutputPath = path.join(outPath, 'logs', logName);
        console.log(`Copying logs from ${vscodeLogs} to ${logOutputPath}`);
        fs.cpSync(vscodeLogs, logOutputPath, { recursive: true, force: true });
    }
}

async function runJestTest(project: string) {
    process.env.JEST_JUNIT_OUTPUT_NAME = getJUnitFileName(project);
    process.env.JEST_SUITE_NAME = project;
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

function getJUnitFileName(logName: string) {
    return `${logName.replaceAll(' ', '_')}_junit.xml`;
}

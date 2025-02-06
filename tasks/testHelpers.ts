/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'fs';
import * as path from 'path';
import { rootPath, outPath } from './projectPaths';
import { prepareVSCodeAndExecuteTests } from '../test/vscodeLauncher';

export const basicSlnTestProject = 'slnWithCsproj';
export const integrationTestProjects = [basicSlnTestProject];

export async function runDevKitIntegrationTests(
    testAssetName: string,
    testFolderName: string,
    suiteName: string,
    env: NodeJS.ProcessEnv = {}
) {
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
                testFile,
                env
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

export async function runIntegrationTest(
    testAssetName: string,
    testFolderName: string,
    suiteName: string,
    vscodeWorkspaceFileName = `${testAssetName}.code-workspace`,
    testFile: string | undefined = undefined,
    env: NodeJS.ProcessEnv = {}
): Promise<number> {
    const testFolder = path.join('test', testFolderName);
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
export async function runJestIntegrationTest(
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
    } catch (err) {
        // If we hit an error, copy the logs VSCode produced to a directory that CI can find.
        const vscodeLogs = path.join(userDataDir, 'logs');
        const logOutputPath = path.join(outPath, 'logs', logName);
        console.log(`Copying logs from ${vscodeLogs} to ${logOutputPath}`);
        fs.cpSync(vscodeLogs, logOutputPath, { recursive: true, force: true });

        throw err;
    }
}

export function getJUnitFileName(logName: string) {
    return `${logName.replaceAll(' ', '_')}_junit.xml`;
}

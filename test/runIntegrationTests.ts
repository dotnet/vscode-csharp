/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as jest from 'jest';
import { Config } from '@jest/types';
import * as cp from 'child_process';
import * as path from 'path';
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';
import { execChildProcess } from '../src/common';

function getSln(workspacePath: string): string | undefined {
    if (workspacePath.endsWith('slnWithGenerator')) {
        return 'slnWithGenerator.sln';
    }
    return undefined;
}

export async function main() {
    try {
        const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
        const [cli, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

        console.log('Display: ' + process.env.DISPLAY);

        const result = cp.spawnSync(
            cli,
            [...args, '--verbose', 'true', '--install-extension', 'ms-dotnettools.vscode-dotnet-runtime'],
            {
                encoding: 'utf-8',
                stdio: 'inherit',
            }
        );
        if (result.error) {
            throw new Error(`Failed to install the runtime extension: ${result.error}`);
        }

        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = process.env.CODE_EXTENSIONS_PATH;
        if (!extensionDevelopmentPath) {
            throw new Error('Environment variable CODE_EXTENSIONS_PATH is empty');
        }

        // The path to the extension test runner script
        // Passed to --extensionTestsPath
        const extensionTestsPath = process.env.EXTENSIONS_TESTS_PATH;

        if (!extensionTestsPath) {
            console.error('Empty extension tests path');
            process.exit(-1);
        }

        // The integration tests expect that the workspace to run the
        // tests against is set in an environment variable.
        const workspacePath = process.env.CODE_TESTS_WORKSPACE;

        if (!workspacePath) {
            console.error(`Empty workspace path`);
            process.exit(-1);
        }

        console.log(`workspace path = '${workspacePath}'`);

        const sln = getSln(workspacePath);
        if (sln) {
            // Run a build before the tests, to ensure that source generators are set up correctly
            if (!process.env.DOTNET_ROOT) {
                throw new Error('Environment variable DOTNET_ROOT is not set');
            }

            const dotnetPath = path.join(process.env.DOTNET_ROOT, 'dotnet');
            await execChildProcess(`${dotnetPath} build ${sln}`, workspacePath);
        }

        // Download VS Code, unzip it and run the integration test
        const exitCode = await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            // Launch with info logging as anything else is way too verbose and will hide test results.
            launchArgs: [workspacePath, '-n', '--log', 'verbose', '--verbose', 'true'],
            extensionTestsEnv: process.env,
        });

        process.exit(exitCode);
    } catch (err) {
        console.error(err);
        console.error('Failed to run tests');
        process.exit(1);
    }
}

export async function runIntegrationTests(projectName: string) {
    const repoRoot = process.env.CODE_EXTENSIONS_PATH;
    if (!repoRoot) {
        throw new Error('CODE_EXTENSIONS_PATH not set.');
    }

    const jestConfigPath = path.join(repoRoot, 'jest.config.ts');
    const jestConfig = {
        config: jestConfigPath,
        selectProjects: [projectName],
        // Since we're running tests in the actual vscode process we have to run them serially.
        runInBand: true,
        // Timeout cannot be overriden in the jest config file, so override here.
        testTimeout: 120000,
        verbose: true,
    } as Config.Argv;

    let filter: string;
    if (process.env.TEST_FILE_FILTER) {
        // If we have just a file, run that with runTestsByPath.
        jestConfig.runTestsByPath = true;
        jestConfig.testMatch = [process.env.TEST_FILE_FILTER];
        filter = process.env.TEST_FILE_FILTER;
    } else {
        filter = projectName;
    }

    const { results } = await jest.runCLI(jestConfig, [filter]);

    if (!results.success) {
        throw new Error('Tests failed.');
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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

async function main() {
    try {
        const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
        const [cli, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

        console.log('Display: ' + process.env.DISPLAY);

        const fullArgs = [...args, '--install-extension', 'ms-dotnettools.vscode-dotnet-runtime'];

        // Since we're using shell execute, spaces in the CLI path will get interpeted as args
        // Therefore we wrap the CLI path in quotes as on MacOS the path can contain spaces.
        const cliWrapped = `"${cli}"`;
        console.log(`${cliWrapped} ${fullArgs}`);

        const result = cp.spawnSync(cliWrapped, fullArgs, {
            encoding: 'utf-8',
            stdio: 'inherit',
            // Workaround as described in https://github.com/nodejs/node/issues/52554
            shell: true,
        });
        if (result.error || result.status !== 0) {
            throw new Error(`Failed to install the runtime extension: ${JSON.stringify(result)}`);
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
            await execChildProcess(`${dotnetPath} build ${sln}`, workspacePath, process.env);
        }

        // Download VS Code, unzip it and run the integration test
        const exitCode = await runTests({
            vscodeExecutablePath: vscodeExecutablePath,
            extensionDevelopmentPath: extensionDevelopmentPath,
            extensionTestsPath: extensionTestsPath,
            // Launch with info logging as anything else is way too verbose and will hide test results.
            launchArgs: [workspacePath, '-n', '--log', 'info'],
            extensionTestsEnv: process.env,
        });

        process.exit(exitCode);
    } catch (err) {
        console.error(err);
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();

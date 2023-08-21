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

        cp.spawnSync(cli, [...args, '--install-extension', 'ms-dotnettools.vscode-dotnet-runtime'], {
            encoding: 'utf-8',
            stdio: 'inherit',
        });

        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test runner script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './integrationTests/index');

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
            launchArgs: [workspacePath, '-n', '--verbose'],
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

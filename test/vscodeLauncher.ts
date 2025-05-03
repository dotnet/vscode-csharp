/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as path from 'path';
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';
import { execChildProcess } from '../src/common';

export async function prepareVSCodeAndExecuteTests(
    extensionDevelopmentPath: string,
    extensionTestsPath: string,
    workspacePath: string,
    userDataDir: string,
    env: NodeJS.ProcessEnv
): Promise<number> {
    let vscodeVersion = 'stable';
    if (process.env.CODE_VERSION) {
        console.log(`VSCode version overriden to ${process.env.CODE_VERSION}.`);
        vscodeVersion = process.env.CODE_VERSION;
    }

    const vscodeExecutablePath = await downloadAndUnzipVSCode(vscodeVersion);
    const [cli, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

    console.log('Display: ' + env.DISPLAY);

    // Different test runs may want to have Dev Kit be active or in-active.
    // Rather than having to uninstall Dev Kit between different test runs, we use workspace settings
    // to control which extensions are active - and we always install Dev Kit.
    const extensionsToInstall = [
        'ms-dotnettools.vscode-dotnet-runtime@2.3.2',
        'ms-dotnettools.csharp',
        'ms-dotnettools.csdevkit@1.16.6',
    ];

    await installExtensions(extensionsToInstall, cli, args);

    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    env.CODE_EXTENSIONS_PATH = extensionDevelopmentPath;

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
        launchArgs: [workspacePath, '-n', '--user-data-dir', userDataDir, '--log', 'ms-dotnettools.csharp:trace'],
        extensionTestsEnv: env,
    });

    return exitCode;
}

async function installExtensions(extensionIds: string[], vscodeCli: string, vscodeArgs: string[]): Promise<void> {
    for (const extensionId of extensionIds) {
        vscodeArgs.push('--install-extension', extensionId);
    }

    // Since we're using shell execute, spaces in the CLI path will get interpeted as args
    // Therefore we wrap the CLI path in quotes as on MacOS the path can contain spaces.
    const cliWrapped = `"${vscodeCli}"`;
    console.log(`${cliWrapped} ${vscodeArgs}`);

    const result = cp.spawnSync(cliWrapped, vscodeArgs, {
        encoding: 'utf-8',
        stdio: 'inherit',
        // Workaround as described in https://github.com/nodejs/node/issues/52554
        shell: true,
    });
    if (result.error || result.status !== 0) {
        throw new Error(`Failed to install the runtime extension: ${JSON.stringify(result)}`);
    }

    console.log();
}

function getSln(workspacePath: string): string | undefined {
    if (workspacePath.endsWith('slnWithGenerator')) {
        return 'slnWithGenerator.sln';
    }
    return undefined;
}

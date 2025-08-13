/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fsExtra from 'fs-extra';
import path from 'path';
import { AggregatedResult } from '@jest/test-result';
import { runIntegrationTests } from '../../runIntegrationTests';
import { jestIntegrationTestProjectName } from './jest.config';
import { activateCSharpExtension } from './integrationHelpers';

export async function run() {
    process.env.RUNNING_INTEGRATION_TESTS = 'true';

    await activateCSharpExtension();
    await moveLogs('activated');

    let anyFailures = false;
    let results: AggregatedResult | undefined;
    if (process.env.TEST_FILE_FILTER) {
        results = await runIntegrationTests(jestIntegrationTestProjectName);
        await moveLogs(path.basename(process.env.TEST_FILE_FILTER, '.integration.test.ts'));
        anyFailures = anyFailures || !results.success;
    } else {
        const workingDirectory = process.cwd();

        const testFiles = (await fsExtra.readdir(__dirname))
            .filter((file) => file.endsWith('.integration.test.js'))
            .map((file) => path.join(__dirname, file));

        for (let file of testFiles) {
            // We have to fix up the file path because the test file was discovered in the /out/ directory.
            file = file.substring(0, file.length - 2) + 'ts';
            file = file.replace(/[\\/]out[\\/]/, path.sep);
            file = workingDirectory[0] + file.substring(1);

            console.log('');
            console.log(`-- Running integration tests for ${path.basename(file)} --`);
            console.log('');

            process.env.TEST_FILE_FILTER = file;

            results = await runIntegrationTests(jestIntegrationTestProjectName);
            await moveLogs(path.basename(process.env.TEST_FILE_FILTER, '.integration.test.ts'));
            anyFailures = anyFailures || !results.success;
        }
    }

    // Explicitly exit the process - VSCode likes to write a bunch of cancellation errors to the console after this
    // which make it look like the tests always fail.  We're done with the tests at this point, so just exit.
    process.exit(anyFailures ? 1 : 0);
}

async function moveLogs(name: string) {
    const exports = vscode.extensions.getExtension('ms-dotnettools.csharp')?.exports;
    if (!exports) {
        throw new Error('Failed to get C# extension exports for cleanup');
    }

    if (!exports.logDirectory) {
        console.warn(`Failed to get log directory from C# extension exports`);
        return;
    }

    const targetLogDir = path.join(
        path.dirname(exports.logDirectory),
        `${name ?? 'unknown'}_${path.basename(exports.logDirectory)}`
    );
    await fsExtra.copy(exports.logDirectory, targetLogDir);
    console.log(`Copied extension logs from ${exports.logDirectory} to ${targetLogDir}`);

    await new Promise((resolve) => fsExtra.rm(path.join(exports.logDirectory, '*.log'), resolve));
}

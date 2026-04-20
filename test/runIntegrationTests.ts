/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import execa from 'execa';
import * as path from 'path';

const integrationProjectConfigs: Record<string, string> = {
    'Integration Tests': path.join('test', 'lsptoolshost', 'integrationTests', 'jest.config.ts'),
    'OmniSharp Integration Tests': path.join('test', 'omnisharp', 'omnisharpIntegrationTests', 'jest.config.ts'),
    'Razor Integration Tests': path.join('test', 'razor', 'razorIntegrationTests', 'jest.config.ts'),
    'Untrusted Integration Tests': path.join('test', 'untrustedWorkspace', 'integrationTests', 'jest.config.ts'),
};

export async function runIntegrationTests(projectName: string) {
    const repoRoot = process.env.CODE_EXTENSIONS_PATH;
    if (!repoRoot) {
        throw new Error('CODE_EXTENSIONS_PATH not set.');
    }

    const configRelativePath = integrationProjectConfigs[projectName];
    if (!configRelativePath) {
        throw new Error(`No Vitest config registered for project '${projectName}'.`);
    }

    // Integration tests run inside the real VS Code process, so make the live API available to the
    // shared vscode mock before Vitest loads any test modules.
    (globalThis as any).vscode = require('vscode');

    const args = ['vitest', 'run', '--config', path.join(repoRoot, configRelativePath)];
    if (process.env.TEST_FILE_FILTER) {
        args.push(process.env.TEST_FILE_FILTER);
    }

    try {
        await execa('npx', args, {
            cwd: repoRoot,
            stdio: 'inherit',
            env: process.env,
        });

        process.exit(0);
    } catch (error: any) {
        if (typeof error?.exitCode === 'number') {
            process.exit(error.exitCode);
        }

        throw error;
    }
}

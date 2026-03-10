/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path from 'path';
import { codeExtensionPath, rootPath } from '../projectPaths';
import { runJestIntegrationTest, runJestTest } from './testHelpers';
import { jestOmniSharpUnitTestProjectName } from '../../test/omnisharp/omnisharpUnitTests/jest.config';

const omnisharpIntegrationTestProjects = ['singleCsproj', 'slnWithCsproj', 'slnFilterWithCsproj', 'BasicRazorApp2_1'];

export async function omnisharpTestUnit(): Promise<void> {
    await runJestTest(jestOmniSharpUnitTestProjectName);
}

export async function omnisharpTestIntegration(skipLsp: boolean = false): Promise<void> {
    for (const projectName of omnisharpIntegrationTestProjects) {
        await runOmnisharpJestIntegrationTest(projectName, 'stdio', `[O#][${projectName}][STDIO]`);
        if (skipLsp) {
            continue;
        }

        await runOmnisharpJestIntegrationTest(projectName, 'lsp', `[O#][${projectName}][LSP]`);
    }
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

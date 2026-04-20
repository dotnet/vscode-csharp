/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path from 'path';
import { codeExtensionPath, rootPath } from '../projectPaths';
import { runVitestIntegrationTest, runVitestTest } from './testHelpers';
import { omnisharpUnitTestProjectName } from '../../test/omnisharp/omnisharpUnitTests/jest.config';

const omnisharpIntegrationTestProjects = ['singleCsproj', 'slnWithCsproj', 'slnFilterWithCsproj', 'BasicRazorApp2_1'];

export async function omnisharpTestUnit(): Promise<void> {
    await runVitestTest(omnisharpUnitTestProjectName);
}

export async function omnisharpTestIntegration(skipLsp: boolean = false): Promise<void> {
    for (const projectName of omnisharpIntegrationTestProjects) {
        await runOmnisharpVitestIntegrationTest(projectName, 'stdio', `[O#][${projectName}][STDIO]`);
        if (skipLsp) {
            continue;
        }

        await runOmnisharpVitestIntegrationTest(projectName, 'lsp', `[O#][${projectName}][LSP]`);
    }
}

async function runOmnisharpVitestIntegrationTest(testAssetName: string, engine: 'stdio' | 'lsp', suiteName: string) {
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

    await runVitestIntegrationTest(testAssetName, testFolder, workspaceFile, suiteName, env);
}

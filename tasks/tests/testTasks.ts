/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { codeExtensionPath, rootPath } from '../projectPaths';
import * as jest from 'jest';
import { Config } from '@jest/types';
import { jestOmniSharpUnitTestProjectName } from '../../test/omnisharp/omnisharpUnitTests/jest.config';
import { jestUnitTestProjectName } from '../../test/lsptoolshost/unitTests/jest.config';
import { razorTestProjectName } from '../../test/razor/razorTests/jest.config';
import { jestArtifactTestsProjectName } from '../../test/lsptoolshost/artifactTests/jest.config';
import { jestTasksTestProjectName } from '../../test/tasks/jest.config';
import {
    getJUnitFileName,
    integrationTestProjects,
    runDevKitIntegrationTests,
    runIntegrationTest,
    runJestIntegrationTest,
} from './testHelpers';

const razorIntegrationTestProjects = ['RazorApp'];
const omnisharpIntegrationTestProjects = ['singleCsproj', 'slnWithCsproj', 'slnFilterWithCsproj', 'BasicRazorApp2_1'];

export async function testArtifactsTask(): Promise<void> {
    await runJestTest(jestArtifactTestsProjectName);
}

// Overall test command that runs everything except O# tests.
export async function testTask(): Promise<void> {
    await testUnitTask();
    await testIntegrationCSharpTask();
    await testIntegrationDevkitTask();
    await testIntegrationRazorCohostTask();
    await runIntegrationTest('empty', path.join('untrustedWorkspace', 'integrationTests'), `[C#][empty]`);
}

export async function testUnitTask(): Promise<void> {
    await runJestTest(jestUnitTestProjectName);
    await runJestTest(razorTestProjectName);
    await runJestTest(jestTasksTestProjectName);
}

export async function testIntegrationCSharpTask(): Promise<void> {
    for (const projectName of integrationTestProjects) {
        await runIntegrationTest(projectName, path.join('lsptoolshost', 'integrationTests'), `[C#][${projectName}]`);
    }
}

export async function testIntegrationDevkitTask(): Promise<void> {
    for (const projectName of integrationTestProjects) {
        await runDevKitIntegrationTests(
            projectName,
            path.join('lsptoolshost', 'integrationTests'),
            `[DevKit][${projectName}]`
        );
    }
}

export async function testIntegrationUntrustedTask(): Promise<void> {
    await runIntegrationTest('empty', path.join('untrustedWorkspace', 'integrationTests'), `[C#][empty]`);
}

export async function testIntegrationRazorCohostTask(): Promise<void> {
    for (const projectName of razorIntegrationTestProjects) {
        await runIntegrationTest(
            projectName,
            path.join('razor', 'razorIntegrationTests'),
            `Razor Test Integration ${projectName}`
        );
    }
}

// OmniSharp tests are run separately in CI, so we have separate tasks for these.
// TODO: Enable lsp integration tests once tests for unimplemented features are disabled.
export async function omnisharpTestTask(): Promise<void> {
    await omnisharpTestUnitTask();
    await omnisharpTestIntegrationTask(/*skipLsp*/ true);
}

export async function omnisharpTestUnitTask(): Promise<void> {
    await runJestTest(jestOmniSharpUnitTestProjectName);
}

export async function omnisharpTestIntegrationTask(skipLsp: boolean = false): Promise<void> {
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

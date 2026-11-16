/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path from 'path';
import { integrationTestProjects, runDevKitIntegrationTests, runIntegrationTest, runJestTest } from './testHelpers';
import { jestArtifactTestsProjectName } from '../../test/lsptoolshost/artifactTests/jest.config';
import { jestUnitTestProjectName } from '../../test/lsptoolshost/unitTests/jest.config';
import { razorTestProjectName } from '../../test/razor/razorTests/jest.config';
import { jestTasksTestProjectName } from '../../test/tasks/jest.config';
import { rootPath } from '../projectPaths';
import { execChildProcess } from '../../src/common';

const csharpIntegrationTestFolder = path.join('lsptoolshost', 'integrationTests');
const razorIntegrationTestProjects = ['RazorApp'];

export async function testArtifacts(): Promise<void> {
    await runJestTest(jestArtifactTestsProjectName);
}

export async function prepareCSharpTestWorkspace(projectName: string): Promise<string> {
    const workspaceRoot = path.join(rootPath, 'test', csharpIntegrationTestFolder, 'testAssets', projectName);
    // Restore before VS Code launches so Roslyn can load the projects immediately.
    console.log(await execChildProcess(`dotnet restore "${workspaceRoot}"`, workspaceRoot, process.env));
    return workspaceRoot;
}

export async function testIntegrationCSharp(): Promise<void> {
    for (const projectName of integrationTestProjects) {
        const workspaceRoot = await prepareCSharpTestWorkspace(projectName);
        // Mark the workspace as prepared so test setup preserves and reuses the restore outputs.
        await runIntegrationTest(
            projectName,
            csharpIntegrationTestFolder,
            `CSharp-${projectName}`,
            undefined,
            undefined,
            {
                ROSLYN_TEST_PREPARED_WORKSPACE: workspaceRoot,
            }
        );
    }
}

export async function testIntegrationDevkit(): Promise<void> {
    for (const projectName of integrationTestProjects) {
        await runDevKitIntegrationTests(
            projectName,
            path.join('lsptoolshost', 'integrationTests'),
            `DevKit-${projectName}`
        );
    }
}

export async function testIntegrationRazorCohost(): Promise<void> {
    for (const projectName of razorIntegrationTestProjects) {
        await runIntegrationTest(projectName, path.join('razor', 'razorIntegrationTests'), `Razor-${projectName}`);
    }
}

export async function testIntegrationUntrusted(): Promise<void> {
    await runIntegrationTest('empty', path.join('untrustedWorkspace', 'integrationTests'), `[C#][empty]`);
}

export async function testUnit(): Promise<void> {
    await runJestTest(jestUnitTestProjectName);
    await runJestTest(razorTestProjectName);
    await runJestTest(jestTasksTestProjectName);
}

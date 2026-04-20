/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path from 'path';
import { integrationTestProjects, runDevKitIntegrationTests, runIntegrationTest, runVitestTest } from './testHelpers';
import { artifactTestsProjectName } from '../../test/lsptoolshost/artifactTests/jest.config';
import { unitTestProjectName } from '../../test/lsptoolshost/unitTests/jest.config';
import { razorTestProjectName } from '../../test/razor/razorTests/jest.config';
import { tasksTestProjectName } from '../../test/tasks/jest.config';

const razorIntegrationTestProjects = ['RazorApp'];

export async function testArtifacts(): Promise<void> {
    await runVitestTest(artifactTestsProjectName);
}

export async function testIntegrationCSharp(): Promise<void> {
    for (const projectName of integrationTestProjects) {
        await runIntegrationTest(projectName, path.join('lsptoolshost', 'integrationTests'), `CSharp-${projectName}`);
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
    await runVitestTest(unitTestProjectName);
    await runVitestTest(razorTestProjectName);
    await runVitestTest(tasksTestProjectName);
}

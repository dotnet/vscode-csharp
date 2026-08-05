/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path from 'path';
import { integrationTestProjects, runDevKitIntegrationTests, runIntegrationTest, runJestTest } from './testHelpers.ts';
import { jestProjectNames } from '../../test/jestProjectNames.mjs';

const razorIntegrationTestProjects = ['RazorApp'];

export async function testArtifacts(): Promise<void> {
    await runJestTest(jestProjectNames.artifact);
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
    await runJestTest(jestProjectNames.unit);
    await runJestTest(jestProjectNames.razorUnit);
    await runJestTest(jestProjectNames.tasksUnit);
}

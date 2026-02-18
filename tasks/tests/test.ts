/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
    testArtifacts,
    testIntegrationCSharp,
    testIntegrationDevkit,
    testIntegrationRazorCohost,
    testIntegrationUntrusted,
    testUnit,
} from './testTasks';
import { runTask } from '../runTask';

runTask(test);

// Overall test command that runs everything except O# tests.
export async function test(): Promise<void> {
    await testArtifacts();
    await testUnit();
    await testIntegrationCSharp();
    await testIntegrationDevkit();
    await testIntegrationRazorCohost();
    await testIntegrationUntrusted();
}

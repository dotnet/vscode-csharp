/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basicSlnTestProject } from './testHelpers';
import { prepareCSharpTestWorkspace } from './testTasks';
import { runTask } from '../runTask';

runTask(async () => {
    await prepareCSharpTestWorkspace(basicSlnTestProject);
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { omnisharpTestIntegration, omnisharpTestUnit } from './omnisharptestTasks';
import { runTask } from '../runTask';

runTask(omnisharpTest);

// OmniSharp tests are run separately in CI, so we have separate tasks for these.
// TODO: Enable lsp integration tests once tests for unimplemented features are disabled.
async function omnisharpTest(): Promise<void> {
    await omnisharpTestUnit();
    await omnisharpTestIntegration(/* skipLsp */ true);
}

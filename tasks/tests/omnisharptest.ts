/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { omnisharpTestIntegration, omnisharpTestUnit } from './omnisharptestTasks';
import { runTask } from '../runTask';
import { parseCodeExtensionPath } from './omnisharptestArguments';

const codeExtensionPath = parseCodeExtensionPath();
runTask(async () => await omnisharpTest(codeExtensionPath));

// OmniSharp tests are run separately in CI, so we have separate tasks for these.
// TODO: Enable lsp integration tests once tests for unimplemented features are disabled.
async function omnisharpTest(codeExtensionPath: string): Promise<void> {
    await omnisharpTestUnit();
    await omnisharpTestIntegration(codeExtensionPath, /* skipLsp */ true);
}

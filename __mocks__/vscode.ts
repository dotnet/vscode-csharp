/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscodeAdapter from '../src/vscodeAdapter';
import { getFakeVsCode } from '../test/unitTests/fakes';

// This module creates a manual mock for the vscode module for running in unit tests.
// Jest will automatically pick this up as it is in the __mocks__ directory next to node_modules.

// We can consider switching to an actual jest mock (instead of this manual fake) once we entirely
// remove the old test framework (mocha/chai).
const vscode: vscodeAdapter.vscode = getFakeVsCode();
module.exports = vscode;

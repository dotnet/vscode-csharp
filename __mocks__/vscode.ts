/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscodeAdapter from '../src/vscodeAdapter';
import { getFakeVsCode } from '../test/fakes';

// This module creates a manual mock for the vscode module for running in unit tests.
// Jest will automatically pick this up as it is in the __mocks__ directory next to node_modules.

// Keep this manual mock lightweight so both unit tests and integration tests can share it.
// Integration runs inject the real VS Code API onto globalThis before the mock is loaded.
const vscode: vscodeAdapter.vscode = ((globalThis as any).vscode as vscodeAdapter.vscode) ?? getFakeVsCode();
module.exports = vscode;

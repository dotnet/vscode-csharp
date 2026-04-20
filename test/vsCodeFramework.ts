/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getFakeVsCode } from './fakes';

// Ensure tests always have a vscode object available. Integration tests replace this with the
// real VS Code API before Vitest starts, while unit tests fall back to a lightweight fake.
(globalThis as any).vscode ??= getFakeVsCode();

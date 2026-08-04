/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { jest } from '@jest/globals';
import * as mockVsCode from '../__mocks__/vscode.ts';

jest.mock('vscode', () => mockVsCode, { virtual: true });
jest.unstable_mockModule('vscode', () => mockVsCode, { virtual: true });

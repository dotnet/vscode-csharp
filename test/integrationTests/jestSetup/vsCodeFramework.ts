/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { jest } from '@jest/globals';

// Defines a virtual mock for the vscode library since it doesn't exist until it gets loaded in by the vscode extension process.
jest.mock('vscode', () => (global as any).vscode, { virtual: true });

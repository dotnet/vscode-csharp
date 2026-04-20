/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Vitest no longer needs a custom environment file to provide the VS Code API. The test setup
// now initializes globalThis.vscode directly, and integration runs replace it with the real API.
export {};

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll, describe } from '@jest/globals';
import * as vscode from 'vscode';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { CommonCommands, OmniSharpCommands, RoslynCommands } from './expectedCommands';

describe(`Command Enablement Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Roslyn commands are available', async () => {
        const commands = await vscode.commands.getCommands(true);

        // Ensure the standalone Roslyn commands are available.
        RoslynCommands.forEach((command) => {
            expect(commands).toContain(command);
        });
        CommonCommands.forEach((command) => {
            expect(commands).toContain(command);
        });

        // Ensure O# commands are not available.
        OmniSharpCommands.forEach((command) => {
            expect(commands).not.toContain(command);
        });
    });
});

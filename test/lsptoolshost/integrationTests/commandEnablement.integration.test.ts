/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, beforeAll, afterAll, describe } from '@jest/globals';
import * as vscode from 'vscode';
import { activateCSharpExtension, testIfCSharp, testIfDevKit } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import {
    RoslynDevKitCommands,
    RoslynStandaloneCommands,
    UnexpectedRoslynDevKitCommands,
    UnexpectedRoslynStandaloneCommands,
} from './expectedCommands';

describe(`Command Enablement Tests`, () => {
    beforeAll(async () => {
        await activateCSharpExtension();
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    testIfCSharp('Roslyn standalone commands are available', async () => {
        const commands = await vscode.commands.getCommands(true);

        // Ensure the standalone Roslyn commands are available.
        RoslynStandaloneCommands.forEach((command) => {
            expect(commands).toContain(command);
        });

        // Ensure other commands are not available.
        UnexpectedRoslynStandaloneCommands.forEach((command) => {
            expect(commands).not.toContain(command);
        });
    });

    testIfDevKit('Roslyn + C# Dev Kit commands are available', async () => {
        const commands = await vscode.commands.getCommands(true);

        // Ensure the Roslyn + C# Dev Kit commands are available
        RoslynDevKitCommands.forEach((command) => {
            expect(commands).toContain(command);
        });

        // Ensure other commands are not available.
        UnexpectedRoslynDevKitCommands.forEach((command) => {
            expect(commands).not.toContain(command);
        });
    });
});

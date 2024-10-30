/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll, describe } from '@jest/globals';
import * as vscode from 'vscode';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';
import { OmniSharpCommands, UnexpectedOmniSharpCommands } from '../../lsptoolshost/integrationTests/expectedCommands';

describe(`Command Enablement: ${testAssetWorkspace.description}`, function () {
    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();
        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Omnisharp commands are available', async function () {
        const commands = await vscode.commands.getCommands(true);

        // Ensure O# commands are available.
        OmniSharpCommands.forEach((command) => {
            expect(commands).toContain(command);
        });

        // Ensure other commands are not available.
        UnexpectedOmniSharpCommands.forEach((command) => {
            expect(commands).not.toContain(command);
        });
    });
});

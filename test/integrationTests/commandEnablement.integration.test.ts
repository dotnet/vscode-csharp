/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll, describe } from '@jest/globals';
import * as vscode from 'vscode';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';

describe(`Command Enablement: ${testAssetWorkspace.description}`, function () {
    beforeAll(async function () {
        await activateCSharpExtension();
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Only expected commands are available', async function () {
        const commands = await vscode.commands.getCommands(true);

        // Ensure the standalone Roslyn commands are available.
        expect(commands).toContain('dotnet.openSolution');
        expect(commands).toContain('dotnet.restartServer');
        expect(commands).toContain('dotnet.generateAssets');
        expect(commands).toContain('dotnet.restore.project');
        expect(commands).toContain('dotnet.restore.all');
        expect(commands).toContain('dotnet.test.runTestsInContext');
        expect(commands).toContain('dotnet.test.debugTestsInContext');
        expect(commands).toContain('csharp.listProcess');
        expect(commands).toContain('csharp.listRemoteProcess');
        expect(commands).toContain('csharp.listRemoteDockerProcess');
        expect(commands).toContain('csharp.attachToProcess');
        expect(commands).toContain('csharp.reportIssue');

        // Ensure the O#-only commands are not available.
        expect(commands).not.toContain('o.restart');
        expect(commands).not.toContain('o.pickProjectAndStart');
        expect(commands).not.toContain('o.fixAll.solution');
        expect(commands).not.toContain('o.fixAll.project');
        expect(commands).not.toContain('o.fixAll.document');
        expect(commands).not.toContain('o.reanalyze.allProjects');
        expect(commands).not.toContain('o.reanalyze.currentProject');
    });
});

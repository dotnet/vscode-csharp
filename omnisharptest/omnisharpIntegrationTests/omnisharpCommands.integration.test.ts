/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll, describe } from '@jest/globals';
import * as vscode from 'vscode';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';

describe(`Command Enablement: ${testAssetWorkspace.description}`, function () {
    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();
        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Only expected commands are available', async function () {
        const commands = await vscode.commands.getCommands(true);

        // Ensure the O# commands are available.
        expect(commands).toContain('o.restart');
        expect(commands).toContain('o.pickProjectAndStart');
        expect(commands).toContain('o.fixAll.solution');
        expect(commands).toContain('o.fixAll.project');
        expect(commands).toContain('o.fixAll.document');
        expect(commands).toContain('o.reanalyze.allProjects');
        expect(commands).toContain('o.reanalyze.currentProject');
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
        expect(commands).toContain('csharp.showDecompilationTerms');

        // Ensure the non-O# commands are not available.
        expect(commands).not.toContain('dotnet.openSolution');
        expect(commands).not.toContain('dotnet.restartServer');
    });
});

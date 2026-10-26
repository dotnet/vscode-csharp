/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { afterEach, beforeAll, describe, expect, test } from '@jest/globals';
import { CancellationToken } from 'vscode-languageclient';
import { CSharpExtensionExports } from '../../../src/csharpExtensionExports';
import { WorkspaceDebugConfigurationRequest } from '../../../src/lsptoolshost/server/roslynProtocol';
import {
    activateCSharpExtension,
    closeAllEditorsAsync,
    getFilePath,
    openFileInWorkspaceAsync,
    waitForAllAsyncOperationsAsync,
    waitForExpectedResult,
    usingDevKit,
} from './integrationHelpers';

// Solution selection must be disabled before activation because restarts reopen previously selected solutions.
const describeIfOnDemandLoad =
    !usingDevKit() && vscode.workspace.getConfiguration('dotnet').get<string>('defaultSolution') === 'disable'
        ? describe
        : describe.skip;

describeIfOnDemandLoad('On-demand project loading', () => {
    let originalLoadOnDemand: boolean | undefined;

    beforeAll(() => {
        originalLoadOnDemand = vscode.workspace
            .getConfiguration('dotnet')
            .inspect<boolean>('projects.loadOnDemand')?.workspaceValue;
    });

    afterEach(async () => {
        await closeAllEditorsAsync();
        await vscode.workspace
            .getConfiguration('dotnet')
            .update('projects.loadOnDemand', originalLoadOnDemand, vscode.ConfigurationTarget.Workspace);
    });

    test.each([true, false])('Loads projects on demand: %s', async (loadOnDemand) => {
        await closeAllEditorsAsync();
        await vscode.workspace
            .getConfiguration('dotnet')
            .update('projects.loadOnDemand', loadOnDemand, vscode.ConfigurationTarget.Workspace);

        const exports = await activateCSharpExtension();
        await waitForAllAsyncOperationsAsync(exports);

        expect(await getLoadedProjectPaths(exports)).toEqual([]);

        await openFileInWorkspaceAsync(path.join('src', 'app', 'Program.cs'));
        await waitForAllAsyncOperationsAsync(exports);

        // Opening the app also loads its project reference, but not the unrelated test project.
        const appProjects = [
            getFilePath(path.join('src', 'app', 'app.csproj')).fsPath,
            getFilePath(path.join('src', 'lib', 'lib.csproj')).fsPath,
        ].sort();
        await waitForExpectedResult(
            async () => getLoadedProjectPaths(exports),
            30000,
            100,
            (projects) => expect(projects).toEqual(loadOnDemand ? appProjects : [])
        );

        await openFileInWorkspaceAsync(path.join('test', 'UnitTest1.cs'));
        await waitForAllAsyncOperationsAsync(exports);
        const allProjects = [...appProjects, getFilePath(path.join('test', 'test.csproj')).fsPath].sort();
        await waitForExpectedResult(
            async () => getLoadedProjectPaths(exports),
            30000,
            100,
            (projects) => expect(projects).toEqual(loadOnDemand ? allProjects : [])
        );
    });
});

async function getLoadedProjectPaths(exports: CSharpExtensionExports): Promise<string[]> {
    const result = await exports.experimental.sendServerRequest(
        WorkspaceDebugConfigurationRequest.type,
        { workspacePath: vscode.workspace.workspaceFolders![0].uri.toString() },
        CancellationToken.None
    );
    return result.map((project) => project.projectPath).sort();
}

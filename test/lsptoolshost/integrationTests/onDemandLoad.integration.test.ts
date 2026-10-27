/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { afterEach, beforeAll, expect, test } from '@jest/globals';
import { CancellationToken } from 'vscode-languageclient';
import { CSharpExtensionExports } from '../../../src/csharpExtensionExports';
import {
    VSProjectContext,
    VSGetProjectContextsRequest,
    WorkspaceDebugConfigurationRequest,
} from '../../../src/lsptoolshost/server/roslynProtocol';
import {
    activateCSharpExtension,
    closeAllEditorsAsync,
    describeIfCSharp,
    getFilePath,
    waitForAllAsyncOperationsAsync,
    waitForExpectedResult,
} from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';

// C# Dev Kit owns project loading and does not support restarting the language server.
describeIfCSharp('On-demand project loading', () => {
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

    test('Loads a project outside the default solution on request when on-demand loading is enabled', async () => {
        await closeAllEditorsAsync();
        await vscode.workspace
            .getConfiguration('dotnet')
            .update('projects.loadOnDemand', true, vscode.ConfigurationTarget.Workspace);

        const exports = await activateCSharpExtension();
        await waitForAllAsyncOperationsAsync(exports);

        const solutionProjects = testAssetWorkspace.projects
            .map((project) => getFilePath(project.relativeFilePath).fsPath)
            .sort();
        expect(await getLoadedProjectPaths(exports)).toEqual(solutionProjects);

        // This project is deliberately not included in the default solution.
        const onDemandProject = getFilePath(path.join('src', 'ondemand', 'ondemand.csproj')).fsPath;
        const expectedProjects = [...solutionProjects, onDemandProject].sort();

        const projectContext = await getNonMiscProjectContext(exports, path.join('src', 'ondemand', 'Class1.cs'));

        expect(projectContext?._vs_label).toMatch(/^ondemand \(/);

        await waitForAllAsyncOperationsAsync(exports);
        await waitForExpectedResult(
            async () => getLoadedProjectPaths(exports),
            /* duration */ 5000,
            /* step */ 100,
            (projects) => expect(projects).toEqual(expectedProjects)
        );
    });

    test('Does not load a project outside the default solution on request when on-demand loading is disabled', async () => {
        await closeAllEditorsAsync();
        await vscode.workspace
            .getConfiguration('dotnet')
            .update('projects.loadOnDemand', false, vscode.ConfigurationTarget.Workspace);

        const exports = await activateCSharpExtension();
        await waitForAllAsyncOperationsAsync(exports);

        const expectedProjects = testAssetWorkspace.projects
            .map((project) => getFilePath(project.relativeFilePath).fsPath)
            .sort();
        expect(await getLoadedProjectPaths(exports)).toEqual(expectedProjects);

        const projectContext = await getNonMiscProjectContext(exports, path.join('src', 'ondemand', 'Class1.cs'));
        expect(projectContext).toBeUndefined();

        await waitForAllAsyncOperationsAsync(exports);
        await waitForExpectedResult(
            async () => getLoadedProjectPaths(exports),
            /* duration */ 5000,
            /* step */ 100,
            (projects) => expect(projects).toEqual(expectedProjects)
        );
    });
});

async function getNonMiscProjectContext(
    exports: CSharpExtensionExports,
    relativeFilePath: string
): Promise<VSProjectContext | undefined> {
    const result = await exports.experimental.sendServerRequest(
        VSGetProjectContextsRequest.type,
        { _vs_textDocument: { uri: getFilePath(relativeFilePath).toString() } },
        CancellationToken.None
    );
    return result._vs_projectContexts.find((context) => !context._vs_is_miscellaneous);
}

async function getLoadedProjectPaths(exports: CSharpExtensionExports): Promise<string[]> {
    const result = await exports.experimental.sendServerRequest(
        WorkspaceDebugConfigurationRequest.type,
        { workspacePath: vscode.workspace.workspaceFolders![0].uri.toString() },
        CancellationToken.None
    );
    return result.map((project) => project.projectPath).sort();
}

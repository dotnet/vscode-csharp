/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect } from '@jest/globals';
import * as vscode from 'vscode';
import {
    resourcesAndFolderMapToLaunchTargets,
    resourcesToLaunchTargets,
    vsls,
    vslsTarget,
} from '../../../src/omnisharp/launcher';
import { LaunchTargetKind } from '../../../src/shared/launchTarget';

describe(`launcher:`, () => {
    const workspaceFolders: vscode.WorkspaceFolder[] = [{ uri: vscode.Uri.parse('/'), name: 'root', index: 0 }];
    const maxProjectResults = 250;

    test(`Returns the LiveShare launch target when processing vsls resources`, () => {
        const testResources: vscode.Uri[] = [
            vscode.Uri.parse(`${vsls}:/test.sln`),
            vscode.Uri.parse(`${vsls}:/test/test.csproj`),
            vscode.Uri.parse(`${vsls}:/test/Program.cs`),
        ];

        const launchTargets = resourcesToLaunchTargets(testResources, workspaceFolders, maxProjectResults);

        const liveShareTarget = launchTargets.find((target) => target === vslsTarget);
        expect(liveShareTarget).toBeDefined();
    });

    test(`Does not return the LiveShare launch target when processing local resources`, () => {
        const testResources: vscode.Uri[] = [
            vscode.Uri.parse(`/test.sln`),
            vscode.Uri.parse(`/test/test.csproj`),
            vscode.Uri.parse(`/test/Program.cs`),
        ];
        const folderMap = new Map<number, vscode.Uri[]>([[0, testResources]]);

        const launchTargets = resourcesAndFolderMapToLaunchTargets(
            testResources,
            workspaceFolders,
            folderMap,
            maxProjectResults
        );

        const liveShareTarget = launchTargets.find((target) => target === vslsTarget);
        expect(liveShareTarget).not.toBeDefined();
    });

    test(`Returns a Solution and Project target`, () => {
        const testResources: vscode.Uri[] = [
            vscode.Uri.parse(`/test.sln`),
            vscode.Uri.parse(`/test/test.csproj`),
            vscode.Uri.parse(`/test/Program.cs`),
        ];
        const folderMap = new Map<number, vscode.Uri[]>([[0, testResources]]);

        const launchTargets = resourcesAndFolderMapToLaunchTargets(
            testResources,
            workspaceFolders,
            folderMap,
            maxProjectResults
        );

        const solutionTarget = launchTargets.find(
            (target) => target.workspaceKind === LaunchTargetKind.Solution && target.label === 'test.sln'
        );
        expect(solutionTarget).toBeDefined();

        const projectTarget = launchTargets.find(
            (target) => target.workspaceKind === LaunchTargetKind.Project && target.label === 'test.csproj'
        );
        expect(projectTarget).toBeDefined();
    });
});

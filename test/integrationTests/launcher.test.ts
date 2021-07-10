/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { assert } from "chai";
import { LaunchTargetKind, resourcesAndFolderMapToLaunchTargets, vsls, vslsTarget } from "../../src/omnisharp/launcher";

suite(`launcher:`, () => {

    const folderMap = new Map<number, vscode.Uri[]>([[0, [vscode.Uri.parse(`/`)]]]);

    test(`Returns the LiveShare launch target when processing vsls resources`, () => {
        const testResources: vscode.Uri[] = [
            vscode.Uri.parse(`${vsls}:/test.sln`),
            vscode.Uri.parse(`${vsls}:/test/test.csproj`),
            vscode.Uri.parse(`${vsls}:/test/Program.cs`),
        ];

        const launchTargets = resourcesAndFolderMapToLaunchTargets(testResources, folderMap);

        const liveShareTarget = launchTargets.find(target => target === vslsTarget);
        assert.exists(liveShareTarget, "Launch targets was not the Visual Studio Live Share target.");
    });

    test(`Does not return the LiveShare launch target when processing local resources`, () => {
        const testResources: vscode.Uri[] = [
            vscode.Uri.parse(`/test.sln`),
            vscode.Uri.parse(`/test/test.csproj`),
            vscode.Uri.parse(`/test/Program.cs`),
        ];

        const launchTargets = resourcesAndFolderMapToLaunchTargets(testResources, folderMap);

        const liveShareTarget = launchTargets.find(target => target === vslsTarget);
        assert.notExists(liveShareTarget, "Launch targets contained the Visual Studio Live Share target.");
    });

    test(`Returns a Solution and Project target`, () => {
        const testResources: vscode.Uri[] = [
            vscode.Uri.parse(`/test.sln`),
            vscode.Uri.parse(`/test/test.csproj`),
            vscode.Uri.parse(`/test/Program.cs`),
        ];

        const launchTargets = resourcesAndFolderMapToLaunchTargets(testResources, folderMap);

        const solutionTarget = launchTargets.find(target => target.kind === LaunchTargetKind.Solution && target.directory === "/test.sln");
        assert.exists(solutionTarget, "Launch targets did not include `/test.sln`");

        const projectTarget = launchTargets.find(target => target.kind === LaunchTargetKind.Project && target.directory === "/test");
        assert.exists(projectTarget, "Launch targets did not include `/test/test.csproj`");
    });
});

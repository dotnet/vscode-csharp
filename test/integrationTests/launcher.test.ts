/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { assert } from "chai";
import { resourcesToLaunchTargets, vsls, vslsTarget } from "../../src/omnisharp/launcher";

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`launcher:`, () => {

    test(`Returns the LiveShare launch target when processing vsls resources`, () => {
        const testResources: vscode.Uri[] = [
            vscode.Uri.parse(`${vsls}:/test.sln`),
            vscode.Uri.parse(`${vsls}:/test/test.csproj`),
            vscode.Uri.parse(`${vsls}:/test/Program.cs`),
        ];

        const launchTargets = resourcesToLaunchTargets(testResources);

        const liveShareTarget = launchTargets.find(target => target === vslsTarget);
        assert.exists(liveShareTarget, "Launch targets was not the Visual Studio Live Share target.");
    });

    test(`Does not return the LiveShare launch target when processing local resources`, () => {
        const testResources: vscode.Uri[] = [
            vscode.Uri.parse(`/test.sln`),
            vscode.Uri.parse(`/test/test.csproj`),
            vscode.Uri.parse(`/test/Program.cs`),
        ];

        const launchTargets = resourcesToLaunchTargets(testResources);

        const liveShareTarget = launchTargets.find(target => target === vslsTarget);
        assert.notExists(liveShareTarget, "Launch targets contained the Visual Studio Live Share target.");
    });
});
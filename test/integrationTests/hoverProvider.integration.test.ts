/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

import { should, expect } from 'chai';
import { activateCSharpExtension, isRazorWorkspace } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';

export type Test = 'a' | 'b' | ['c', any];

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`Hover Provider: ${testAssetWorkspace.description}`, function () {
    suiteSetup(async function () {
        should();

        // These tests don't run on the BasicRazorApp2_1 solution
        if (isRazorWorkspace(vscode.workspace)) {
            this.skip();
        }

        await activateCSharpExtension();
        await testAssetWorkspace.restore();
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Hover returns structured documentation with proper newlines", async function () {
        let fileName = 'hover.cs';
        let dir = testAssetWorkspace.projects[0].projectDirectoryPath;
        let loc = path.join(dir, fileName);
        let fileUri = vscode.Uri.file(loc);

        await vscode.commands.executeCommand("vscode.open", fileUri);
        let c = <vscode.Hover[]>(await vscode.commands.executeCommand("vscode.executeHoverProvider", fileUri, new vscode.Position(10, 29)));
        let answer: string =
            "```csharp\nbool testissue.Compare(int gameObject, string tagName)\n```\n\nChecks if object is tagged with the tag\\.\n\nReturns:\n\n  Returns true if object is tagged with tag\\.";

        expect((<{ language: string; value: string }>c[0].contents[0]).value).to.equal(answer);
    });
});

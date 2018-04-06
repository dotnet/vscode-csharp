/*--------------------------------------------------------------------------------------------- 
*  Copyright (c) Microsoft Corporation. All rights reserved. 
*  Licensed under the MIT License. See License.txt in the project root for license information. 
*--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as vscode from 'vscode';
import * as path from 'path';

import poll from './poll';
import { should, expect } from 'chai';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { OmniSharpServer } from '../../src/omnisharp/server';
import { omnisharp } from '../../src/omnisharp/extension';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`Hover Provider: ${testAssetWorkspace.description}`, function () {
    suiteSetup(async function () {
        should();

        let csharpExtension = vscode.extensions.getExtension("ms-vscode.csharp");
        if (!csharpExtension.isActive) {
            await csharpExtension.activate();
        }

        await csharpExtension.exports.initializationFinished;
    });

    test("Hover returns structured documentation with proper newlines", async function () {
        let fileName = 'hover.cs';
        let dir = path.dirname(testAssetWorkspace.projects[0].projectDirectoryPath);
        let loc = path.join(dir, fileName);
        let fileUri = vscode.Uri.file(loc);

        await vscode.commands.executeCommand("vscode.open", fileUri);
        let c = await vscode.commands.executeCommand("vscode.executeHoverProvider", fileUri, new vscode.Position(10, 29));
        let answer: string =
            `Checks if object is tagged with the tag.

Parameters:

\t\tgameObject: The game object.
\t\ttagName: Name of the tag.

Returns true if object is tagged with tag.`;
        expect(c[0].contents[0].value).to.equal(answer);
    });

    teardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });
});
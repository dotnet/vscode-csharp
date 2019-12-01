/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { should, expect } from 'chai';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as path from 'path';
import { assertWithPoll } from './poll';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`Code Action Rename ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();
        await activateCSharpExtension();
        await testAssetWorkspace.restore();

        let fileName = 'A.cs';
        let projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        let filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Code actions can rename and open files", async () => {
        await vscode.commands.executeCommand("vscode.open", fileUri);
        let c = await vscode.commands.executeCommand("vscode.executeCodeActionProvider", fileUri, new vscode.Range(0, 7, 0, 7)) as { command: string, title: string, arguments: string[] }[];
        let command = c.find(
            (s) => { return s.title == "Rename file to C.cs"; }
        );
        expect(command, "Didn't find rename class command");

        await vscode.commands.executeCommand(command.command, ...command.arguments);

        await assertWithPoll(() => { }, 15 * 1000, 500, _ => expect(vscode.window.activeTextEditor.document.fileName).contains("C.cs"));
    });
});
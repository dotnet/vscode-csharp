/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { should, expect } from 'chai';
import { activateCSharpExtension, isRazorWorkspace } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as path from 'path';
import { assertWithPoll } from './poll';
import { CodeAction } from 'vscode-languageclient';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

type CodeActionReturn = vscode.Command | (CodeAction & { arguments: undefined });

suite(`Code Action Rename ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        // These tests don't run on the BasicRazorApp2_1 solution
        if (isRazorWorkspace(vscode.workspace)) {
            this.skip();
        }

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
        let c = await vscode.commands.executeCommand("vscode.executeCodeActionProvider", fileUri, new vscode.Range(0, 7, 0, 7)) as CodeActionReturn[];
        if (!c || c.some(z => !z?.title)) {
            c = await vscode.commands.executeCommand("vscode.executeCodeActionProvider", fileUri, new vscode.Range(0, 7, 0, 7)) as CodeActionReturn[];
        }
        let command = c.find(
            (s) => { return s.title == "Rename file to C.cs"; }
        );
        expect(command, "Didn't find rename class command");

        let commandStr: string;
        let args: string[];

        if (command.arguments) {
            commandStr = command.command as string;
            args = command.arguments as string[];
        }
        else {
            const codeAction = command as CodeAction;
            commandStr = codeAction.command.command;
            args = codeAction.command.arguments;
        }

        await vscode.commands.executeCommand(commandStr, ...args);

        await assertWithPoll(() => { }, 15 * 1000, 500, _ => expect(vscode.window.activeTextEditor.document.fileName).contains("C.cs"));
    });
});

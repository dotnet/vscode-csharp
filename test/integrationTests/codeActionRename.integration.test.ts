/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { should, expect } from 'chai';
import { activateCSharpExtension, isRazorWorkspace, isSlnWithGenerator } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import * as path from 'path';
import { assertWithPoll } from './poll';
import { isNotNull } from '../testUtil';

suite(`Code Action Rename ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        console.log("Checking if razor workspace or solution with generator");

        if (isRazorWorkspace(vscode.workspace) || isSlnWithGenerator(vscode.workspace)) {
            console.log("skipping test");
            this.skip();
        }

        console.log("Running test");

        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restoreAndWait(activation);

        const fileName = 'A.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        const filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Code actions can rename and open files', async () => {
        await vscode.commands.executeCommand('vscode.open', fileUri);
        const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
            'vscode.executeCodeActionProvider',
            fileUri,
            new vscode.Range(0, 7, 0, 7)
        );
        const codeAction = codeActions.find((codeAction) => codeAction.title == 'Rename file to C.cs');
        expect(codeAction, "Didn't find rename class code action");
        isNotNull(codeAction?.command?.command);
        isNotNull(codeAction?.command?.arguments);

        await vscode.commands.executeCommand(codeAction.command.command, ...codeAction.command.arguments);

        await assertWithPoll(
            () => {
                /* empty */
            },
            15 * 1000,
            500,
            (_) => expect(vscode.window.activeTextEditor!.document.fileName).contains('C.cs')
        );
    });
});

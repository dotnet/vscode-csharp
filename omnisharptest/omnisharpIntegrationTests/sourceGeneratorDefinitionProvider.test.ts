/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test, beforeAll, afterAll } from '@jest/globals';
import * as vscode from 'vscode';
import * as path from 'path';
import OmniSharpDefinitionProvider from '../../src/features/definitionProvider';
import { activateCSharpExtension, describeIfGenerator, restartOmniSharpServer } from './integrationHelpers';
import { assertWithPoll, sleep } from './poll';
import testAssetWorkspace from './testAssets/activeTestAssetWorkspace';

describeIfGenerator(`${OmniSharpDefinitionProvider.name}: ${testAssetWorkspace.description}`, () => {
    let fileUri: vscode.Uri;

    beforeAll(async function () {
        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();
        await vscode.commands.executeCommand('dotnet.generateAssets', 0);
        await sleep(100);
        const tasks = await vscode.tasks.fetchTasks();
        const task = tasks.filter((task) => task.name === 'build')[0];
        expect(task).not.toBeUndefined();
        await vscode.tasks.executeTask(task);
        await restartOmniSharpServer();

        const fileName = 'GeneratorTrigger.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        await vscode.commands.executeCommand('vscode.open', fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    afterAll(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test('Generated file returns definitions and adds source', async () => {
        const textStart = new vscode.Position(11, 41);
        const definitionList = <vscode.Location[]>(
            await vscode.commands.executeCommand('vscode.executeDefinitionProvider', fileUri, textStart)
        );
        expect(definitionList.length).toEqual(1);
        expect(definitionList[0]).toBeDefined();
        expect(definitionList[0].uri.path).toContain('GeneratedCode.cs');

        const generatedCodeUri = definitionList[0].uri;
        const generatedCodeDocument = await vscode.workspace.openTextDocument(generatedCodeUri);
        expect(generatedCodeDocument.getText()).toContain('Hello world!');
        expect(generatedCodeDocument.getText()).not.toContain('Goodbye');

        await vscode.commands.executeCommand('vscode.open', fileUri);
        const textEdit = new vscode.WorkspaceEdit();
        textEdit.replace(fileUri, new vscode.Range(new vscode.Position(9, 27), new vscode.Position(9, 38)), 'Goodbye');
        expect(await vscode.workspace.applyEdit(textEdit)).toBe(true);

        await vscode.commands.executeCommand('vscode.open', generatedCodeUri);
        await assertWithPoll(
            () => {
                /* empty */
            },
            15 * 1000,
            500,
            (_) => {
                const documentText = vscode.window.activeTextEditor!.document.getText();
                expect(documentText).not.toContain('Hello world!');
                expect(documentText).toContain('Goodbye');
            }
        );
    });
});

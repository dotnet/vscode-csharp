/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, should } from "chai";
import * as vscode from "vscode";
import * as path from 'path';
import CSharpDefinitionProvider from "../../src/features/definitionProvider";
import { activateCSharpExtension, isSlnWithGenerator, restartOmniSharpServer } from "./integrationHelpers";
import { assertWithPoll, sleep } from "./poll";
import testAssetWorkspace from "./testAssets/testAssetWorkspace";

suite(`${CSharpDefinitionProvider.name}: ${testAssetWorkspace.description}`, () => {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        if (!isSlnWithGenerator(vscode.workspace)) {
            this.skip();
        }

        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restoreAndWait(activation);
        await vscode.commands.executeCommand("dotnet.generateAssets", 0);
        await sleep(100);
        const tasks = await vscode.tasks.fetchTasks();
        const task = (tasks).filter(task => task.name === 'build')[0];
        expect(task).to.not.be.undefined;
        await vscode.tasks.executeTask(task);
        await restartOmniSharpServer();

        const fileName = 'GeneratorTrigger.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        await vscode.commands.executeCommand("vscode.open", fileUri);
    });

    test("Generated file returns definitions and adds source", async () => {
        if (!isSlnWithGenerator(vscode.workspace)) {
            return;
        }

        const textStart = new vscode.Position(11, 41);
        const definitionList = <vscode.Location[]>(await vscode.commands.executeCommand("vscode.executeDefinitionProvider", fileUri, textStart));
        expect(definitionList.length).to.be.equal(1);
        expect(definitionList[0]).to.exist;
        expect(definitionList[0].uri.path).to.contain("GeneratedCode.cs");

        const generatedCodeUri = definitionList[0].uri;
        let generatedCodeDocument = await vscode.workspace.openTextDocument(generatedCodeUri);
        expect(generatedCodeDocument.getText()).contains("Hello world!");
        expect(generatedCodeDocument.getText()).does.not.contain("Goodbye");

        await vscode.commands.executeCommand('vscode.open', fileUri);
        const textEdit = new vscode.WorkspaceEdit();
        textEdit.replace(fileUri, new vscode.Range(new vscode.Position(9, 27), new vscode.Position(9, 38)), "Goodbye");
        expect(await vscode.workspace.applyEdit(textEdit)).to.be.true;

        await vscode.commands.executeCommand('vscode.open', generatedCodeUri);
        await assertWithPoll(() => { }, 15 * 1000, 500, _ => {
            const documentText = vscode.window.activeTextEditor.document.getText();
            expect(documentText).does.not.contain("Hello world!");
            expect(documentText).contains("Goodbye");
        });
    });
});

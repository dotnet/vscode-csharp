/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import CSharpDefinitionProvider from "../../src/features/definitionProvider";
import * as path from "path";
import testAssetWorkspace from "./testAssets/testAssetWorkspace";
import { expect } from "chai";
import { activateCSharpExtension, isRazorWorkspace, isSlnWithCsproj, restartOmniSharpServer } from './integrationHelpers';
import { assertWithPoll } from "./poll";

suite(`${CSharpDefinitionProvider.name}: ${testAssetWorkspace.description}`, () => {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        // These tests don't run on the BasicRazorApp2_1 solution
        if (isRazorWorkspace(vscode.workspace)) {
            this.skip();
        }

        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restoreAndWait(activation);

        const fileName = 'definition.cs';
        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        await vscode.commands.executeCommand("vscode.open", fileUri);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns the definition", async () => {
        const definitionList = <vscode.Location[]>(await vscode.commands.executeCommand("vscode.executeDefinitionProvider", fileUri, new vscode.Position(10, 31)));
        expect(definitionList.length).to.be.equal(1);
        expect(definitionList[0]).to.exist;
        expect(definitionList[0].uri.path).to.contain("definition.cs");
    });

    test("Returns the definition from Metadata", async () => {
        const omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        await omnisharpConfig.update('enableDecompilationSupport', false, vscode.ConfigurationTarget.Global);
        await restartOmniSharpServer();

        const definitionList = <vscode.Location[]>(await vscode.commands.executeCommand("vscode.executeDefinitionProvider", fileUri, new vscode.Position(10, 25)));
        expect(definitionList.length).to.be.equal(1);
        expect(definitionList[0]).to.exist;
        expect(definitionList[0].uri.path).to.contain("[metadata] Console.cs");
    });

    test("Returns multiple definitions for partial types", async () => {
        const definitionList = <vscode.Location[]>(await vscode.commands.executeCommand("vscode.executeDefinitionProvider", fileUri, new vscode.Position(4, 25)));
        expect(definitionList.length).eq(2);
        expect(definitionList[0]).to.exist;
        expect(definitionList[0].uri.path).to.contain("definition.cs");
        expect(definitionList[1]).to.exist;
        expect(definitionList[1].uri.path).to.contain("definition.cs");
    });

    test("Generated file returns definitions and adds source", async () => {
        if (!isSlnWithCsproj(vscode.workspace)) {
            return;
        }

        const projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        const generatorTriggerUri = vscode.Uri.file(path.join(projectDirectory, 'GeneratorTrigger.cs'));
        const textStart = new vscode.Position(11, 41);
        await vscode.commands.executeCommand('vscode.open', generatorTriggerUri);

        // // We need to do a full build in order to get the source generator built and ready to run, or tests will fail
        // await vscode.commands.executeCommand("dotnet.generateAssets", 0);
        // await sleep(100);
        // const tasks = await vscode.tasks.fetchTasks();
        // const task = (tasks).filter(task => task.name === 'build')[0];
        // expect(task).to.not.be.undefined;
        // await vscode.tasks.executeTask(task);
        // await restartOmniSharpServer();

        const definitionList = <vscode.Location[]>(await vscode.commands.executeCommand("vscode.executeDefinitionProvider", generatorTriggerUri, textStart));
        expect(definitionList.length).to.be.equal(1);
        expect(definitionList[0]).to.exist;
        expect(definitionList[0].uri.path).to.contain("GeneratedCode.cs");

        const generatedCodeUri = definitionList[0].uri;
        let generatedCodeDocument = await vscode.workspace.openTextDocument(generatedCodeUri);
        expect(generatedCodeDocument.getText()).contains("Hello world!");
        expect(generatedCodeDocument.getText()).does.not.contain("Goodbye");

        await vscode.commands.executeCommand('vscode.open', generatorTriggerUri);
        const textEdit = new vscode.WorkspaceEdit();
        textEdit.replace(generatorTriggerUri, new vscode.Range(new vscode.Position(9, 27), new vscode.Position(9, 38)), "Goodbye");
        expect(await vscode.workspace.applyEdit(textEdit)).to.be.true;

        await vscode.commands.executeCommand('vscode.open', generatedCodeUri);
        await assertWithPoll(() => { }, 15 * 1000, 500, _ => {
            const documentText = vscode.window.activeTextEditor.document.getText();
            expect(documentText).does.not.contain("Hello world!");
            expect(documentText).contains("Goodbye");
        });
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });
});

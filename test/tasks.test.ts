/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { getRegisteredTaskProvider } from '../src/vscodeTasksAdapter';
import { should } from 'chai';
import workspaceData from '../testAssets/workspaces';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`Tasks generation: ${workspaceData.name}`, () => {
    let tasks: vscode.Task[];
    let buildTasks: vscode.Task[];
    
    suiteSetup(async () => {
        this.setTimeout(60000);
        should();
console.log(vscode.workspace.rootPath);
for (var file of await vscode.workspace.findFiles("**/*.*")) {
    console.log(file.fsPath);
}
        let csharpExtension = vscode.extensions.getExtension("ms-vscode.csharp");
        if (!csharpExtension.isActive) {
            await csharpExtension.activate();
        }
console.log(JSON.stringify(csharpExtension));
console.log("Is the extension active?");
        await vscode.commands.executeCommand('workbench.action.tasks.runTask'); 

        let registeredTaskProvider = await getRegisteredTaskProvider(30000);

        tasks = await registeredTaskProvider
            .provider
            .provideTasks();

        buildTasks = tasks.filter((value) => value.name.startsWith("build "));
    });

    test(`a build task should be available for each project`, async () => {
        buildTasks
             .should.have.length(workspaceData.projects.length);
    });
    
    test("build tasks should produce non-empty bin and obj directories", async () => {        
        await workspaceData.deleteBuildArtifacts();
        
        for (let task of buildTasks) {
            await vscode
                .commands
                .executeCommand('workbench.action.tasks.runTask', task.name);
        }

        workspaceData
            .projects
            .forEach(p => {
                p.binDirectoryPath.should.exist.and.not.be.empty;
                p.objDirectoryPath.should.exist.and.not.be.empty;
            });
    });
});

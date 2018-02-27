/*--------------------------------------------------------------------------------------------- 
 *  Copyright (c) Microsoft Corporation. All rights reserved. 
 *  Licensed under the MIT License. See License.txt in the project root for license information. 
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as vscode from 'vscode';

import poll from './poll';
import { should, expect } from 'chai';
import testAssetWorkspace from './testAssets/testAssetWorkspace';

const chai = require('chai'); 
chai.use(require('chai-arrays')); 
chai.use(require('chai-fs')); 
 
suite(`Code Action Rename ${testAssetWorkspace.description}`, function() {
    suiteSetup(async function() { 
        should();

        let csharpExtension = vscode.extensions.getExtension("ms-vscode.csharp"); 
        if (!csharpExtension.isActive) { 
            await csharpExtension.activate(); 
        }

        await csharpExtension.exports.initializationFinished;

    });
    
    test("Code actions can rename and open files", async () => {                
        let fileUri = await testAssetWorkspace.projects[0].addFileWithContents("test.cs", "class C {}");
        await vscode.commands.executeCommand("vscode.open", fileUri);
        let c = await vscode.commands.executeCommand("vscode.executeCodeActionProvider", fileUri, new vscode.Range(0, 7, 0, 7)) as {command: string, title: string, arguments: string[]}[];
        let command = c.find(
            (s) => { return s.title == "Rename file to C.cs"; }
        );
        expect(command, "Didn't find rename class command");
        await vscode.commands.executeCommand(command.command, ...command.arguments)
        expect(vscode.window.activeTextEditor.document.fileName).contains("C.cs");
    });

    teardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });
}); 
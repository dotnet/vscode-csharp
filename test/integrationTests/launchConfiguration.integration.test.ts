/*--------------------------------------------------------------------------------------------- 
 *  Copyright (c) Microsoft Corporation. All rights reserved. 
 *  Licensed under the MIT License. See License.txt in the project root for license information. 
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as vscode from 'vscode';

import poll from './poll';
import { should } from 'chai';
import testAssetWorkspace from './testAssets/testAssetWorkspace';

const chai = require('chai'); 
chai.use(require('chai-arrays')); 
chai.use(require('chai-fs')); 
 
suite(`Tasks generation: ${testAssetWorkspace.description}`, function() {
    suiteSetup(async function() { 
        should();
        
        let csharpExtension = vscode.extensions.getExtension("ms-vscode.csharp"); 
        if (!csharpExtension.isActive) { 
            await csharpExtension.activate(); 
        }

        await testAssetWorkspace.cleanupWorkspace();

        await csharpExtension.exports.initializationFinished;
        
        await vscode.commands.executeCommand("dotnet.generateAssets");

        await poll(async () => await fs.exists(testAssetWorkspace.launchJsonPath), 10000, 100);
        console.log("suite launch finished");
    }); 
 
    test("Starting .NET Core Launch (console) from the workspace root should create an Active Debug Session", async () => { 
        console.log("Launch Test Started");     
        await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], ".NET Core Launch (console)");

        let debugSessionTerminated = new Promise(resolve => {
            vscode.debug.onDidTerminateDebugSession((e) => resolve());
        });
        
        vscode.debug.activeDebugSession.type.should.equal("coreclr");

        await debugSessionTerminated;
        console.log("Launch Test Ended"); 
    });

    teardown(async() =>
    {   
        console.log("Teardown started Launch Test");        
        await testAssetWorkspace.cleanupWorkspace();
        console.log("Teardown finished Launch Test");     
    })
});
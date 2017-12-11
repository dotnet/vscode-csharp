/*--------------------------------------------------------------------------------------------- 
*  Copyright (c) Microsoft Corporation. All rights reserved. 
*  Licensed under the MIT License. See License.txt in the project root for license information. 
*--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as vscode from 'vscode';

import poll from './poll';
import { should, expect } from 'chai';
import testAssetWorkspace from './testAssets/testAssetWorkspace';
import { RequestQueueCollection } from '../../src/omnisharp/requestQueue';
import { OmniSharpServer } from '../../src/omnisharp/server';
import { omnisharp } from '../../src/omnisharp/extension';

const chai = require('chai'); 
chai.use(require('chai-arrays')); 
chai.use(require('chai-fs')); 

suite(`Tasks generation: ${testAssetWorkspace.description}`, function() {
    suiteSetup(async function() { 
        should();
        console.log("Suite start");
        let csharpExtension = vscode.extensions.getExtension("ms-vscode.csharp"); 
        if (!csharpExtension.isActive) { 
            await csharpExtension.activate(); 
        }

        await testAssetWorkspace.cleanupWorkspace();

        await csharpExtension.exports.initializationFinished;
        
        await vscode.commands.executeCommand("dotnet.generateAssets");

        await poll(async () => await fs.exists(testAssetWorkspace.launchJsonPath), 10000, 100);
        
        console.log("Suite end");
    }); 


   test("Hover returns structured documentation with proper newlines", async function ()  {                

    console.log("Test start");
    //await vscode.commands.executeCommand("dotnet.restore");
       var program = 
`using System;
namespace hoverXmlDoc
{
   class testissue
   {
       ///<summary>Checks if object is tagged with the tag.</summary>
       /// <param name="gameObject">The game object.</param>
       /// <param name="tagName">Name of the tag.</param>
       /// <returns>Returns <c> true</c> if object is tagged with tag.</returns>
       
       public static bool Compare(int gameObject,string tagName)
       {
           return true;
       }
   }
}`;
       let fileUri = await testAssetWorkspace.projects[0].addFileWithContents("test1.cs", program); 

       await omnisharp.waitForEmptyEventQueue();

       await vscode.commands.executeCommand("vscode.open", fileUri);
       /*var d = await fs.exists(fileUri.fsPath);
       console.log("File exists",d);*/
       let c = await vscode.commands.executeCommand("vscode.executeHoverProvider", fileUri,new vscode.Position(10,29));

       let answer:string = 
`Summary: Checks if object is tagged with the tag.

Parameters:

gameObject: The game object.

tagName: Name of the tag.

Returns: Returns trueif object is tagged with tag.`;
       expect(c[0].contents[0].value).to.equal(answer);
       console.log("Test end ");
    });
   
    teardown(async() =>
    {   
        console.log("Teardown start");
        await testAssetWorkspace.cleanupWorkspace();
        console.log("Teardown end");     
    })
});
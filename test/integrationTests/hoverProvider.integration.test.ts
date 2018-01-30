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

        await testAssetWorkspace.cleanupWorkspace();

        let csharpExtension = vscode.extensions.getExtension("ms-vscode.csharp"); 
        if (!csharpExtension.isActive) { 
            await csharpExtension.activate(); 
        }


        await csharpExtension.exports.initializationFinished;
        await omnisharp.restart();


        await vscode.commands.executeCommand("dotnet.generateAssets");

        await poll(async () => await fs.exists(testAssetWorkspace.launchJsonPath), 10000, 100);
        
    }); 


   test("Hover returns structured documentation with proper newlines", async function ()  {                

       let program = 
`using System;
namespace Test
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

       let c = await vscode.commands.executeCommand("vscode.executeHoverProvider", fileUri,new vscode.Position(10,29));

       let answer:string = 
`Checks if object is tagged with the tag.

Parameters:

\t\tgameObject: The game object.
\t\ttagName: Name of the tag.

Returns trueif object is tagged with tag.`;
       expect(c[0].contents[0].value).to.equal(answer);
    });
   
    teardown(async() =>
    {   
        await testAssetWorkspace.cleanupWorkspace();     
    })
});
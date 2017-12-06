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

suite(`Test Hover Behavior ${testAssetWorkspace.description}`, function() {
   suiteSetup(async function() { 
       should();

       let csharpExtension = vscode.extensions.getExtension("ms-vscode.csharp"); 
       if (!csharpExtension.isActive) { 
           await csharpExtension.activate();
       }
       
       await csharpExtension.exports.initializationFinished;
   });


   test("Hover returns the correct XML", async () => {                

       var program = 
`using System;
namespace hoverXmlDoc
{
   class testissue
   {
       ///<summary>Checks if object is tagged with the tag.</summary>
       /// <param name="gameObject">The game object.</param>
       /// <param name="tagName">Name of the tag </param>
       /// <returns>Returns <c> true</c>if object is tagged with tag.</returns>
       
       public static bool Compare(int gameObject,string tagName)
       {
           return gameObject.TagifyCompareTag(tagName);
       }
   }
}`;
       let fileUri = await testAssetWorkspace.projects[0].addFileWithContents("test1.cs", program); 
       await vscode.commands.executeCommand("vscode.open", fileUri);

       let c = await vscode.commands.executeCommand("vscode.executeHoverProvider", fileUri,new vscode.Position(10,29));
       let answer:string = "Checks if object is tagged with the tag.\n\ngameObject: The game object.\n\ntagName: Name of the tag \n\nReturns: Returns trueif object is tagged with tag.";
       expect(c[0].contents[0].value).to.equal(answer);       
   });
});
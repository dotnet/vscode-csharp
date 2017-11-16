
import * as fs from 'async-file';
import * as vscode from 'vscode';
import * as path from 'path';

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

        testAssetWorkspace.deleteBuildArtifacts();
        
        await fs.rimraf(testAssetWorkspace.vsCodeDirectoryPath);
        
        await csharpExtension.exports.initializationFinished;
                
        await vscode.commands.executeCommand("dotnet.generateAssets");
        
        await poll(async () => await fs.exists(testAssetWorkspace.launchJsonPath), 10000, 100);

    });


    test("Hover returns the correct XML", async () => {                
        
        let program : string = "using System;\
        \nnamespace hoverXmlDoc \
        \n{\
        \n    class testissue\
        \n    {\
        \n    ///<summary>Checks if object is tagged with the tag.</summary>\
        \n    /// <param name=\"gameObject\">The game object.</param> \
        \n    /// <param name=\"tagName\">Name of the tag </param>\
        \n    /// <returns>Returns <c> true</c>if object is tagged with tag.</returns>\
        \n\
        \n        public static bool Compare(int gameObject,string tagName)\
        \n        {\
        \n            return gameObject.TagifyCompareTag(tagName);\
        \n        }\
        \n    }\
        }";
        let fileUri = await testAssetWorkspace.projects[0].addFileWithContents("test.cs", program); 
        await vscode.commands.executeCommand("vscode.open", fileUri);

        let c = await vscode.commands.executeCommand("vscode.executeHoverProvider", fileUri,new vscode.Position(10,30));
        let answer:string = "Checks if object is tagged with the tag.\n\ngameObject: The game object.\n\ntagName: Name of the tag \n\nReturns: Returns trueif object is tagged with tag.";
        expect(c[0].contents[0].value).to.equal(answer);
        
    });

});
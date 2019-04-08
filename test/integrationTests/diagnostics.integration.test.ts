/*--------------------------------------------------------------------------------------------- 
*  Copyright (c) Microsoft Corporation. All rights reserved. 
*  Licensed under the MIT License. See License.txt in the project root for license information. 
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

import { should, expect } from 'chai';
import { activateCSharpExtension } from './integrationHelpers';
import testAssetWorkspace from './testAssets/testAssetWorkspace';

const chai = require('chai');
chai.use(require('chai-arrays'));
chai.use(require('chai-fs'));

suite(`DiagnosticProvider: ${testAssetWorkspace.description}`, function () {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();
        await testAssetWorkspace.restore();
        await activateCSharpExtension();

        let fileName = 'documentSymbols.cs';
        let projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        let filePath = path.join(projectDirectory, fileName);
        fileUri = vscode.Uri.file(filePath);

        let csharpConfig = vscode.workspace.getConfiguration('omnisharp');
        await csharpConfig.update('enableRoslynAnalyzers', true);

        await vscode.commands.executeCommand("vscode.open", fileUri);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns diagnostics from file", async function () {
        let result = await pollForAny(() => vscode.languages.getDiagnostics(fileUri), 1000, 50);
        expect(result.length).to.be.greaterThan(0); // dummy test as proof of concept...
    });
});

// todo refactor this to poll function with type interference etc etc
async function pollForAny<T>(getValue: () => T[], duration: number, step: number): Promise<T[]> {
    while (duration > 0) {
        let value = await getValue();
 
        if (value && value.length > 0) {
            return value;
        } 
 
        await sleep(step);
 
        duration -= step; 
    } 
 
    throw new Error("Polling did not succeed within the alotted duration.");
} 

async function sleep(ms = 0) {
    return new Promise(r => setTimeout(r, ms)); 
}
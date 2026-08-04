/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';

import { ITestAssetWorkspace, TestAssetWorkspace } from './testAssets.js';

import singleCsproj from './singleCsproj.js';
import slnWithCsproj from './slnWithCsproj.js';
import slnFilterWithCsproj from './slnFilterWithCsproj.js';
import RazorApp from './razorApp.js';
import slnWithGenerator from './slnWithGenerator.js';

const testAssetWorkspaces: { [x: string]: ITestAssetWorkspace } = {
    singleCsproj,
    slnWithCsproj,
    slnFilterWithCsproj,
    RazorApp,
    slnWithGenerator,
};

const workspaceName = path.basename(vscode.workspace.workspaceFolders![0].uri.fsPath);

const activeTestAssetWorkspace = new TestAssetWorkspace(testAssetWorkspaces[workspaceName!]);

export default activeTestAssetWorkspace;

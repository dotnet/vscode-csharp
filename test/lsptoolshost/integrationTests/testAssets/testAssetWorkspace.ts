/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';

import { ITestAssetWorkspace, TestAssetWorkspace } from './testAssets.ts';

import singleCsproj from './singleCsproj.ts';
import slnWithCsproj from './slnWithCsproj.ts';
import slnFilterWithCsproj from './slnFilterWithCsproj.ts';
import RazorApp from './razorApp.ts';
import slnWithGenerator from './slnWithGenerator.ts';

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

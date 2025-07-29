/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';

import { ITestAssetWorkspace, TestAssetWorkspace } from './testAssets';

import singleCsproj from './singleCsproj';
import slnWithCsproj from './slnWithCsproj';
import slnFilterWithCsproj from './slnFilterWithCsproj';
import RazorApp from './razorApp';
import slnWithGenerator from './slnWithGenerator';

const testAssetWorkspaces: { [x: string]: ITestAssetWorkspace } = {
    singleCsproj,
    slnWithCsproj,
    slnFilterWithCsproj,
    RazorApp,
    slnWithGenerator,
};

const workspaceName = vscode.workspace.workspaceFolders![0].uri.fsPath.split(path.sep).pop();

const activeTestAssetWorkspace = new TestAssetWorkspace(testAssetWorkspaces[workspaceName!]);

export default activeTestAssetWorkspace;

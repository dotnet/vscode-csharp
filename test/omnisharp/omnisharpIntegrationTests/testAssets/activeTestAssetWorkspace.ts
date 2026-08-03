/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';

import { ITestAssetWorkspace } from '../../../lsptoolshost/integrationTests/testAssets/testAssets.js';

import singleCsproj from '../../../lsptoolshost/integrationTests/testAssets/singleCsproj.js';
import slnWithCsproj from '../../../lsptoolshost/integrationTests/testAssets/slnWithCsproj.js';
import slnFilterWithCsproj from '../../../lsptoolshost/integrationTests/testAssets/slnFilterWithCsproj.js';
import BasicRazorApp2_1 from '../../../lsptoolshost/integrationTests/testAssets/razorApp.js';
import slnWithGenerator from '../../../lsptoolshost/integrationTests/testAssets/slnWithGenerator.js';
import { OmnisharpTestAssetWorkspace } from './omnisharpTestAssetWorkspace.js';

const testAssetWorkspaces: { [x: string]: ITestAssetWorkspace } = {
    singleCsproj,
    slnWithCsproj,
    slnFilterWithCsproj,
    BasicRazorApp2_1,
    slnWithGenerator,
};

const workspaceName = vscode.workspace.workspaceFolders![0].uri.fsPath.split(path.sep).pop();

const activeTestAssetWorkspace = new OmnisharpTestAssetWorkspace(testAssetWorkspaces[workspaceName!]);

export default activeTestAssetWorkspace;

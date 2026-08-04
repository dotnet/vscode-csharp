/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';

import { ITestAssetWorkspace } from '../../../lsptoolshost/integrationTests/testAssets/testAssets.ts';

import singleCsproj from '../../../lsptoolshost/integrationTests/testAssets/singleCsproj.ts';
import slnWithCsproj from '../../../lsptoolshost/integrationTests/testAssets/slnWithCsproj.ts';
import slnFilterWithCsproj from '../../../lsptoolshost/integrationTests/testAssets/slnFilterWithCsproj.ts';
import BasicRazorApp2_1 from '../../../lsptoolshost/integrationTests/testAssets/razorApp.ts';
import slnWithGenerator from '../../../lsptoolshost/integrationTests/testAssets/slnWithGenerator.ts';
import { OmnisharpTestAssetWorkspace } from './omnisharpTestAssetWorkspace.ts';

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

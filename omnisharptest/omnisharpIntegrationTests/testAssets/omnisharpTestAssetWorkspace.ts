/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';

import { ITestAssetWorkspace } from '../../../test/integrationTests/testAssets/testAssets';

import singleCsproj from '../../../test/integrationTests/testAssets/singleCsproj';
import slnWithCsproj from '../../../test/integrationTests/testAssets/slnWithCsproj';
import slnFilterWithCsproj from '../../../test/integrationTests/testAssets/slnFilterWithCsproj';
import BasicRazorApp2_1 from '../../../test/integrationTests/testAssets/basicRazorApp21';
import slnWithGenerator from '../../../test/integrationTests/testAssets/slnWithGenerator';
import { OmnisharpTestAssetWorkspace } from './omnisharpTestAssets';

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

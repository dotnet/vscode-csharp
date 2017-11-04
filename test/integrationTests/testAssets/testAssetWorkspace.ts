/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';

import {ITestAssetWorkspace, TestAssetWorkspace} from './testAssets';

const testAssetWorkspaces: { [x: string]: ITestAssetWorkspace } = {
};

const workspaceName = vscode.workspace.rootPath
    .split(path.sep)
    .pop();

const activeTestAssetWorkspace = new TestAssetWorkspace(testAssetWorkspaces[workspaceName]);

export default activeTestAssetWorkspace;
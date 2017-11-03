import * as vscode from 'vscode';
import * as path from 'path';
import {ITestAssetWorkspace, TestAssetWorkspace} from './testAssets';

import singleCsproj from './singleCsproj';
import singleProjectJson from './singleProjectJson';
import slnWithCsproj from './slnWithCsproj';

const testAssetWorkspaces: { [x: string]: ITestAssetWorkspace } = {
    singleCsproj,
    singleProjectJson,
    slnWithCsproj
}

const workspaceName = vscode.workspace.rootPath
    .split(path.sep)
    .pop();

const activeTestAssetWorkspace = new TestAssetWorkspace(testAssetWorkspaces[workspaceName]);

export default activeTestAssetWorkspace;
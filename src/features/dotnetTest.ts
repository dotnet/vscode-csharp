/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {OmnisharpServer} from '../omnisharpServer';
import * as vscode from 'vscode';
import * as serverUtils from "../omnisharpUtils";

export function registerDotNetTestRunCommand(server: OmnisharpServer): vscode.Disposable {
    return vscode.commands.registerCommand(
        'dotnet.test.run',
        (testMethod, fileName) => runDotnetTest(testMethod, fileName, server));
}

export function registerDotNetTestDebugCommand(server: OmnisharpServer): vscode.Disposable {
    return vscode.commands.registerCommand(
        'dotnet.test.debug',
        (testMethod, fileName) => debugDotnetTest(testMethod, fileName, server));
}

// Run test through dotnet-test command. This function can be moved to a separate structure
export function runDotnetTest(testMethod: string, fileName: string, server: OmnisharpServer) {
    serverUtils
        .runDotNetTest(server, { FileName: fileName, MethodName: testMethod })
        .then(
        response => {
            if (response.Pass) {
                vscode.window.showInformationMessage('Test passed');
            }
            else {
                vscode.window.showErrorMessage('Test failed');
            }
        },
        reason => {
            vscode.window.showErrorMessage('Fail to run test because ' + reason + '.');
        });
}

// Run test through dotnet-test command with debugger attached
export function debugDotnetTest(testMethod: string, fileName: string, server: OmnisharpServer) {
    serverUtils.getTestStartInfo(server, { FileName: fileName, MethodName: testMethod }).then(response => {
        vscode.commands.executeCommand(
            'vscode.startDebug', {
                "name": ".NET test launch",
                "type": "coreclr",
                "request": "launch",
                "program": response.Executable,
                "args": response.Argument.split(' '),
                "cwd": "${workspaceRoot}",
                "stopAtEntry": false
            }
        ).then(undefined, reason => { vscode.window.showErrorMessage('Failed to debug test because ' + reason + '.') });
    });
}
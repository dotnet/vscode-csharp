/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {OmnisharpServer} from '../omnisharpServer';
import {toRange} from '../typeConvertion';
import * as vscode from 'vscode';
import * as serverUtils from "../omnisharpUtils";
import * as protocol from '../protocol';

let enableDebug = false;

// check if debugger start is enable
vscode.commands.getCommands().then(commands => {
    if (commands.find(c => c == "vscode.startDebug")) {
        enableDebug = true;
    }
});

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
        ).then(
            response => {
                vscode.window.showInformationMessage('call back from debugger start command')
            },
            reason => { vscode.window.showErrorMessage('Failed to debug test because ' + reason + '.') });
    });
}

export function updateCodeLensForTest(bucket: vscode.CodeLens[], fileName: string, node: protocol.Node) {
    let testFeature = node.Features.find(value => value.startsWith('XunitTestMethod'));
    if (testFeature) {
        // this test method has a test feature
        let testMethod = testFeature.split(':')[1];

        bucket.push(new vscode.CodeLens(
            toRange(node.Location),
            { title: "run test", command: 'dotnet.test.run', arguments: [testMethod, fileName] }));

        if (enableDebug) {
            bucket.push(new vscode.CodeLens(
                toRange(node.Location),
                { title: "debug test", command: 'dotnet.test.debug', arguments: [testMethod, fileName] }));
        }
    }
}
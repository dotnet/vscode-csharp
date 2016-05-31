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

let _testOutputChannel: vscode.OutputChannel = undefined;

function getTestOutputChannel(): vscode.OutputChannel {
    if (_testOutputChannel == undefined) {
        _testOutputChannel = vscode.window.createOutputChannel(".NET Test Log");
    }

    return _testOutputChannel;
}

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
    getTestOutputChannel().show();
    getTestOutputChannel().appendLine('Running test ' + testMethod + '...');
    serverUtils
        .runDotNetTest(server, { FileName: fileName, MethodName: testMethod })
        .then(
        response => {
            if (response.Pass) {
                getTestOutputChannel().appendLine('Test passed \n');
            }
            else {
                getTestOutputChannel().appendLine('Test failed \n');
            }
        },
        reason => {
            vscode.window.showErrorMessage(`Failed to run test because ${reason}.`);
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
            response => { },
            reason => { vscode.window.showErrorMessage(`Failed to start debugger on test because ${reason}.`) });
    });
}

export function updateCodeLensForTest(bucket: vscode.CodeLens[], fileName: string, node: protocol.Node, isDebugEnable: boolean) {
    // backward compatible check: Features property doesn't present on older version OmniSharp
    if (node.Features == undefined) {
        return;
    }

    let testFeature = node.Features.find(value => value.Name == 'XunitTestMethod');
    if (testFeature) {
        // this test method has a test feature

        bucket.push(new vscode.CodeLens(
            toRange(node.Location),
            { title: "run test", command: 'dotnet.test.run', arguments: [testFeature.Data, fileName] }));

        if (isDebugEnable) {
            bucket.push(new vscode.CodeLens(
                toRange(node.Location),
                { title: "debug test", command: 'dotnet.test.debug', arguments: [testFeature.Data, fileName] }));
        }
    }
}
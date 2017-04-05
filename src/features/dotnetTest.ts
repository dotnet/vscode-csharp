/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {OmniSharpServer} from '../omnisharp/server';
import {toRange} from '../omnisharp/typeConvertion';
import * as vscode from 'vscode';
import * as serverUtils from "../omnisharp/utils";
import * as protocol from '../omnisharp/protocol';

let _testOutputChannel: vscode.OutputChannel = undefined;

function getTestOutputChannel(): vscode.OutputChannel {
    if (_testOutputChannel == undefined) {
        _testOutputChannel = vscode.window.createOutputChannel(".NET Test Log");
    }

    return _testOutputChannel;
}

export function registerDotNetTestRunCommand(server: OmniSharpServer): vscode.Disposable {
    return vscode.commands.registerCommand(
        'dotnet.test.run',
        (testMethod, fileName, testFrameworkName) => runDotnetTest(testMethod, fileName, testFrameworkName, server));
}

export function registerDotNetTestDebugCommand(server: OmniSharpServer): vscode.Disposable {
    return vscode.commands.registerCommand(
        'dotnet.test.debug',
        (testMethod, fileName, testFrameworkName) => debugDotnetTest(testMethod, fileName, testFrameworkName, server));
}

// Run test through dotnet-test command. This function can be moved to a separate structure
export function runDotnetTest(testMethod: string, fileName: string, testFrameworkName: string, server: OmniSharpServer) {
    getTestOutputChannel().show();
    getTestOutputChannel().appendLine(`Running test ${testMethod}...`);

    let disposable = server.onTestMessage(e =>
    {
        getTestOutputChannel().appendLine(e.Message);
    });

    serverUtils
        .runDotNetTest(server, { FileName: fileName, MethodName: testMethod, TestFrameworkName: testFrameworkName })
        .then(
        response => {
            if (response.Pass) {
                getTestOutputChannel().appendLine('Test passed \n');
            }
            else {
                getTestOutputChannel().appendLine('Test failed \n');
            }

            disposable.dispose();
        },
        reason => {
            vscode.window.showErrorMessage(`Failed to run test because ${reason}.`);
            disposable.dispose();
        });
}

// Run test through dotnet-test command with debugger attached
export function debugDotnetTest(testMethod: string, fileName: string, testFrameworkName: string, server: OmniSharpServer) {
    serverUtils.getTestStartInfo(server, { FileName: fileName, MethodName: testMethod, TestFrameworkName: testFrameworkName }).then(response => {
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
            reason => { vscode.window.showErrorMessage(`Failed to start debugger on test because ${reason}.`); });
    });
}

export function updateCodeLensForTest(bucket: vscode.CodeLens[], fileName: string, node: protocol.Node, isDebugEnable: boolean) {
    // backward compatible check: Features property doesn't present on older version OmniSharp
    if (node.Features == undefined) {
        return;
    }

    let testFeature = node.Features.find(value => (value.Name == 'XunitTestMethod' || value.Name == 'NUnitTestMethod'));
    if (testFeature) {
        // this test method has a test feature
        let testFrameworkName = testFeature.Name == 'XunitTestMethod' ? 'xunit' : 'nunit';
        bucket.push(new vscode.CodeLens(
            toRange(node.Location),
            { title: "run test", command: 'dotnet.test.run', arguments: [testFeature.Data, fileName, testFrameworkName] }));

        if (isDebugEnable) {
            bucket.push(new vscode.CodeLens(
                toRange(node.Location),
                { title: "debug test", command: 'dotnet.test.debug', arguments: [testFeature.Data, fileName, testFrameworkName] }));
        }
    }
}
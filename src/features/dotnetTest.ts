/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmniSharpServer } from '../omnisharp/server';
import { toRange } from '../omnisharp/typeConvertion';
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
    const output = getTestOutputChannel();

    output.show();
    output.appendLine(`Running test ${testMethod}...`);

    const disposable = server.onTestMessage(e => {
        output.appendLine(e.Message);
    });

    const request: protocol.V2.RunTestRequest = {
        Filename: fileName,
        MethodName: testMethod,
        TestFrameworkName: testFrameworkName
    };

    serverUtils.runTest(server, request)
        .then(response => {
            if (response.Pass) {
                output.appendLine('Test passed \n');
            }
            else {
                output.appendLine('Test failed \n');
            }

            disposable.dispose();
        },
        reason => {
            vscode.window.showErrorMessage(`Failed to run test because ${reason}.`);
            disposable.dispose();
        });
}

function getLaunchConfigurationForAttach(server: OmniSharpServer, fileName: string, testMethod: string, testFrameworkName: string): Promise<any> {
    const request: protocol.V2.GetTestStartInfoRequest = {
        Filename: fileName,
        MethodName: testMethod,
        TestFrameworkName: testFrameworkName
    };

    return serverUtils.debugTestStart(server, request)
        .then(response => {
            return {
                name: ".NET Test Attach",
                type: "coreclr",
                request: "attach",
                processId: response.ProcessId
            };
        });
}

function getLaunchConfigurationForLaunch(server: OmniSharpServer, fileName: string, testMethod: string, testFrameworkName: string): Promise<any> {
    const request: protocol.V2.GetTestStartInfoRequest = {
        Filename: fileName,
        MethodName: testMethod,
        TestFrameworkName: testFrameworkName
    };

    return serverUtils.getTestStartInfo(server, request)
        .then(response => {
            let args = response.Argument.split(' ');

            // Ensure that quoted args are unquoted.
            args = args.map(arg => {
                if (arg.startsWith('"') && arg.endsWith('"')) {
                    return arg.substring(1, arg.length - 1);
                }
                else {
                    return arg;
                }
            });

            return {
                name: ".NET Test Launch",
                type: "coreclr",
                request: "launch",
                program: response.Executable,
                args: args,
                cwd: response.WorkingDirectory,
                stopAtEntry: false
            };
        });
}


function getLaunchConfiguration(server: OmniSharpServer, debugType: string, fileName: string, testMethod: string, testFrameworkName: string): Promise<any> {
    switch (debugType) {
        case "attach":
            return getLaunchConfigurationForAttach(server, fileName, testMethod, testFrameworkName);
        case "launch":
            return getLaunchConfigurationForLaunch(server, fileName, testMethod, testFrameworkName);

        default:
            throw new Error(`Unexpected PreferredDebugType: ${debugType}`);
    }
}

// Run test through dotnet-test command with debugger attached
export function debugDotnetTest(testMethod: string, fileName: string, testFrameworkName: string, server: OmniSharpServer) {
    const request: protocol.V2.DebugTestCheckRequest = {
        Filename: fileName
    };

    let debugType: string;

    return serverUtils.debugTestCheck(server, request)
        .then(response => {
            debugType = response.PreferredDebugType;
            return getLaunchConfiguration(server, debugType, fileName, testMethod, testFrameworkName);
        })
        .then(config => {
            return vscode.commands.executeCommand('vscode.startDebug', config);
        })
        .then(() => {
            if (debugType === "attach") {
                serverUtils.debugTestReady(server, { Filename: fileName });
            }
        })
        .catch(reason => vscode.window.showErrorMessage(`Failed to start debugger: ${reason}`));
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
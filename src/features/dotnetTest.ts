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
        FileName: fileName,
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

function createLaunchConfiguration(program: string, argsString: string, cwd: string) {
    let args = argsString.split(' ');

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
        program,
        args,
        cwd,
        stopAtEntry: true
    };
}

function getLaunchConfigurationForVSTest(server: OmniSharpServer, fileName: string, testMethod: string, testFrameworkName: string): Promise<any> {
    const request: protocol.V2.DebugTestGetStartInfoRequest = {
        FileName: fileName,
        MethodName: testMethod,
        TestFrameworkName: testFrameworkName
    };

    return serverUtils.debugTestGetStartInfo(server, request)
        .then(response => createLaunchConfiguration(response.FileName, response.Arguments, response.WorkingDirectory));
}

function getLaunchConfigurationForLegacy(server: OmniSharpServer, fileName: string, testMethod: string, testFrameworkName: string): Promise<any> {
    const request: protocol.V2.GetTestStartInfoRequest = {
        FileName: fileName,
        MethodName: testMethod,
        TestFrameworkName: testFrameworkName
    };

    return serverUtils.getTestStartInfo(server, request)
        .then(response => createLaunchConfiguration(response.Executable, response.Argument, response.WorkingDirectory));
}


function getLaunchConfiguration(server: OmniSharpServer, debugType: string, fileName: string, testMethod: string, testFrameworkName: string): Promise<any> {
    switch (debugType) {
        case "legacy":
            return getLaunchConfigurationForLegacy(server, fileName, testMethod, testFrameworkName);
        case "vstest":
            return getLaunchConfigurationForVSTest(server, fileName, testMethod, testFrameworkName);

        default:
            throw new Error(`Unexpected debug type: ${debugType}`);
    }
}

// Run test through dotnet-test command with debugger attached
export function debugDotnetTest(testMethod: string, fileName: string, testFrameworkName: string, server: OmniSharpServer) {
    // We support to styles of 'dotnet test' for debugging: The legacy 'project.json' testing, and the newer csproj support
    // using VS Test. These require a different level of communication.
    let debugType: string;

    return serverUtils.requestProjectInformation(server, { FileName: fileName} )
        .then(projectInfo => {
            if (projectInfo.DotNetProject) {
                debugType = "legacy";
            }
            else if (projectInfo.MsBuildProject) {
                debugType = "vstest";
            }
            else {
                throw new Error();
            }

            return getLaunchConfiguration(server, debugType, fileName, testMethod, testFrameworkName);
        })
        .then(config => vscode.commands.executeCommand('vscode.startDebug', config))
        .then(() => {
            // For VS Test, we need to signal to start the test run after the debugger has launched.
            // TODO: Need to find out when the debugger has actually launched. This is currently a race.
            if (debugType === "vstest") {
                serverUtils.debugTestRun(server, { FileName: fileName });
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
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmniSharpServer } from '../omnisharp/server';
import { toRange } from '../omnisharp/typeConvertion';
import { DebuggerEventsProtocol } from '../coreclr-debug/debuggerEventsProtocol';
import * as vscode from 'vscode';
import * as serverUtils from "../omnisharp/utils";
import * as protocol from '../omnisharp/protocol';
import * as utils from '../common';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

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
            const totalTests = response.Results.length;

            let totalPassed = 0, totalFailed = 0, totalSkipped = 0;
            for (let result of response.Results) {
                switch (result.Outcome) {
                    case protocol.V2.TestOutcomes.Failed:
                        totalFailed += 1;
                        break;
                    case protocol.V2.TestOutcomes.Passed:
                        totalPassed += 1;
                        break;
                    case protocol.V2.TestOutcomes.Skipped:
                        totalSkipped += 1;
                        break;
                }
            }

            output.appendLine('');
            output.appendLine(`Total tests: ${totalTests}. Passed: ${totalPassed}. Failed: ${totalFailed}. Skipped: ${totalSkipped}`);
            output.appendLine('');

            disposable.dispose();
        },
        reason => {
            vscode.window.showErrorMessage(`Failed to run test because ${reason}.`);
            disposable.dispose();
        });
}

function createLaunchConfiguration(program: string, args: string, cwd: string, debuggerEventsPipeName: string) {
    let debugOptions = vscode.workspace.getConfiguration('csharp').get('unitTestDebugingOptions');

    // Get the initial set of options from the workspace setting
    let result:any;
    if (typeof debugOptions === "object") {
        // clone the options object to avoid changing it
        result = JSON.parse(JSON.stringify(debugOptions));
    } else {
        result = {};
    }

    // Now fill in the rest of the options
    result.name = ".NET Test Launch";
    result.type = "coreclr";
    result.request = "launch";
    result.debuggerEventsPipeName = debuggerEventsPipeName;
    result.program = program;
    result.args = args;
    result.cwd = cwd;

    return result;
}

function getLaunchConfigurationForVSTest(server: OmniSharpServer, fileName: string, testMethod: string, testFrameworkName: string, debugEventListener: DebugEventListener): Promise<any> {

    const request: protocol.V2.DebugTestGetStartInfoRequest = {
        FileName: fileName,
        MethodName: testMethod,
        TestFrameworkName: testFrameworkName
    };

    return serverUtils.debugTestGetStartInfo(server, request)
        .then(response => createLaunchConfiguration(response.FileName, response.Arguments, response.WorkingDirectory, debugEventListener.pipePath()));
}

function getLaunchConfigurationForLegacy(server: OmniSharpServer, fileName: string, testMethod: string, testFrameworkName: string): Promise<any> {
    const request: protocol.V2.GetTestStartInfoRequest = {
        FileName: fileName,
        MethodName: testMethod,
        TestFrameworkName: testFrameworkName
    };

    return serverUtils.getTestStartInfo(server, request)
        .then(response => createLaunchConfiguration(response.Executable, response.Argument, response.WorkingDirectory, null));
}


function getLaunchConfiguration(server: OmniSharpServer, debugType: string, fileName: string, testMethod: string, testFrameworkName: string, debugEventListener: DebugEventListener): Promise<any> {
    switch (debugType) {
        case "legacy":
            return getLaunchConfigurationForLegacy(server, fileName, testMethod, testFrameworkName);
        case "vstest":
            return getLaunchConfigurationForVSTest(server, fileName, testMethod, testFrameworkName, debugEventListener);

        default:
            throw new Error(`Unexpected debug type: ${debugType}`);
    }
}

// Run test through dotnet-test command with debugger attached
export function debugDotnetTest(testMethod: string, fileName: string, testFrameworkName: string, server: OmniSharpServer) {
    // We support to styles of 'dotnet test' for debugging: The legacy 'project.json' testing, and the newer csproj support
    // using VS Test. These require a different level of communication.
    let debugType: string;
    let debugEventListener: DebugEventListener = null;
    let outputChannel = getTestOutputChannel();
    outputChannel.appendLine(`Debugging method '${testMethod}'.`);

    return serverUtils.requestProjectInformation(server, { FileName: fileName })
        .then(projectInfo => {
            if (projectInfo.DotNetProject) {
                debugType = "legacy";
                return Promise.resolve();
            }
            else if (projectInfo.MsBuildProject) {
                debugType = "vstest";
                debugEventListener = new DebugEventListener(fileName, server, outputChannel);
                return debugEventListener.start();
            }
            else {
                throw new Error();
            }
        })
        .then(() => getLaunchConfiguration(server, debugType, fileName, testMethod, testFrameworkName, debugEventListener))
        .then(config => vscode.commands.executeCommand('vscode.startDebug', config))
        .catch(reason => {
            vscode.window.showErrorMessage(`Failed to start debugger: ${reason}`);
            if (debugEventListener != null) {
                debugEventListener.close();
            }
        });
}

export function updateCodeLensForTest(bucket: vscode.CodeLens[], fileName: string, node: protocol.Node, isDebugEnable: boolean) {
    // backward compatible check: Features property doesn't present on older version OmniSharp
    if (node.Features == undefined) {
        return;
    }

    let testFeature = node.Features.find(value => (value.Name == 'XunitTestMethod' || value.Name == 'NUnitTestMethod' || value.Name == 'MSTestMethod'));
    if (testFeature) {
        // this test method has a test feature
        let testFrameworkName = 'xunit';
        if(testFeature.Name == 'NunitTestMethod')
        {
            testFrameworkName = 'nunit';
        }
        else if(testFeature.Name == 'MSTestMethod')
        {
            testFrameworkName = 'mstest';
        }
        
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

class DebugEventListener {
    static s_activeInstance: DebugEventListener = null;
    _fileName: string;
    _server: OmniSharpServer;
    _outputChannel: vscode.OutputChannel;
    _pipePath: string;

    _serverSocket: net.Server;
    _isClosed: boolean = false;

    constructor(fileName: string, server: OmniSharpServer, outputChannel: vscode.OutputChannel) {
        this._fileName = fileName;
        this._server = server;
        this._outputChannel = outputChannel;
        // NOTE: The max pipe name on OSX is fairly small, so this name shouldn't bee too long.
        const pipeSuffix = "TestDebugEvents-" + process.pid;
        if (os.platform() === 'win32') {
            this._pipePath = "\\\\.\\pipe\\Microsoft.VSCode.CSharpExt." + pipeSuffix;
        } else {
            this._pipePath = path.join(utils.getExtensionPath(), "." + pipeSuffix);
        }
    }

    public start(): Promise<void> {

        // We use our process id as part of the pipe name, so if we still somehow have an old instance running, close it.
        if (DebugEventListener.s_activeInstance !== null) {
            DebugEventListener.s_activeInstance.close();
        }
        DebugEventListener.s_activeInstance = this;

        this._serverSocket = net.createServer((socket: net.Socket) => {
            socket.on('data', (buffer: Buffer) => {
                let event: DebuggerEventsProtocol.DebuggerEvent;
                try {
                    event = DebuggerEventsProtocol.decodePacket(buffer);
                }
                catch (e) {
                    this._outputChannel.appendLine("Warning: Invalid event received from debugger");
                    return;
                }

                switch (event.eventType) {
                    case DebuggerEventsProtocol.EventType.ProcessLaunched:
                        let processLaunchedEvent = <DebuggerEventsProtocol.ProcessLaunchedEvent>(event);
                        this._outputChannel.appendLine(`Started debugging process #${processLaunchedEvent.targetProcessId}.`);
                        this.onProcessLaunched(processLaunchedEvent.targetProcessId);
                        break;

                    case DebuggerEventsProtocol.EventType.DebuggingStopped:
                        this._outputChannel.appendLine("Debugging complete.\n");
                        this.onDebuggingStopped();
                        break;
                }
            });

            socket.on('end', () => {
                this.onDebuggingStopped();
            });
        });

        return this.removeSocketFileIfExists().then(() => {
            return new Promise<void>((resolve, reject) => {
                let isStarted: boolean = false;
                this._serverSocket.on('error', (err: Error) => {
                    if (!isStarted) {
                        reject(err.message);
                    } else {
                        this._outputChannel.appendLine("Warning: Communications error on debugger event channel. " + err.message);
                    }
                });
                this._serverSocket.listen(this._pipePath, () => {
                    isStarted = true;
                    resolve();
                });
            });
        });
    }

    public pipePath(): string {
        return this._pipePath;
    }

    public close() {
        if (this === DebugEventListener.s_activeInstance) {
            DebugEventListener.s_activeInstance = null;
        }

        if (this._isClosed) {
            return;
        }

        this._isClosed = true;

        if (this._serverSocket !== null) {
            this._serverSocket.close();
        }
    }

    private onProcessLaunched(targetProcessId: number): void {
        let request: protocol.V2.DebugTestLaunchRequest = {
            FileName: this._fileName,
            TargetProcessId: targetProcessId
        };

        const disposable = this._server.onTestMessage(e => {
            this._outputChannel.appendLine(e.Message);
        });

        serverUtils.debugTestLaunch(this._server, request)
            .then(_ => {
                disposable.dispose();
            });
    }

    private onDebuggingStopped(): void {
        if (this._isClosed) {
            return;
        }

        let request: protocol.V2.DebugTestStopRequest = {
            FileName: this._fileName
        };

        serverUtils.debugTestStop(this._server, request);

        this.close();
    }

    private removeSocketFileIfExists(): Promise<void> {
        if (os.platform() === 'win32') {
            // Win32 doesn't use the file system for pipe names
            return Promise.resolve();
        }
        else {
            return utils.deleteIfExists(this._pipePath);
        }
    }
}
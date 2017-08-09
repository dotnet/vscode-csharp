/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmniSharpServer } from '../omnisharp/server';
import { DebuggerEventsProtocol } from '../coreclr-debug/debuggerEventsProtocol';
import * as vscode from 'vscode';
import * as serverUtils from "../omnisharp/utils";
import * as protocol from '../omnisharp/protocol';
import * as utils from '../common';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import TelemetryReporter from 'vscode-extension-telemetry';
import AbstractProvider from './abstractProvider';

const TelemetryReportingDelay = 2 * 60 * 1000; // two minutes

export default class TestManager extends AbstractProvider {
    private _channel: vscode.OutputChannel;

    private _runCounts: { [testFrameworkName: string]: number };
    private _debugCounts: { [testFrameworkName: string]: number };
    private _telemetryIntervalId: NodeJS.Timer = undefined;

    constructor(server: OmniSharpServer, reporter: TelemetryReporter) {
        super(server, reporter);

        // register commands
        let d1 = vscode.commands.registerCommand(
            'dotnet.test.run',
            (testMethod, fileName, testFrameworkName) => this._runDotnetTest(testMethod, fileName, testFrameworkName));

        let d2 = vscode.commands.registerCommand(
            'dotnet.test.debug',
            (testMethod, fileName, testFrameworkName) => this._debugDotnetTest(testMethod, fileName, testFrameworkName));

        this._telemetryIntervalId = setInterval(() =>
            this._reportTelemetry(), TelemetryReportingDelay);

        let d3 = new vscode.Disposable(() => {
            if (this._telemetryIntervalId !== undefined) {
                // Stop reporting telemetry
                clearInterval(this._telemetryIntervalId);
                this._telemetryIntervalId = undefined;
                this._reportTelemetry();
            }
        });

        this.addDisposables(d1, d2, d3);
    }

    private _getOutputChannel(): vscode.OutputChannel {
        if (this._channel === undefined) {
            this._channel = vscode.window.createOutputChannel(".NET Test Log");
            this.addDisposables(this._channel);
        }

        return this._channel;
    }

    private _recordRunRequest(testFrameworkName: string): void {
        if (this._runCounts === undefined) {
            this._runCounts = {};
        }

        let count = this._runCounts[testFrameworkName];

        if (!count) {
            count = 1;
        }
        else {
            count += 1;
        }

        this._runCounts[testFrameworkName] = count;
    }

    private _recordDebugRequest(testFrameworkName: string): void {
        if (this._debugCounts === undefined) {
            this._debugCounts = {};
        }

        let count = this._debugCounts[testFrameworkName];

        if (!count) {
            count = 1;
        }
        else {
            count += 1;
        }

        this._debugCounts[testFrameworkName] = count;
    }

    private _reportTelemetry(): void {
        if (this._runCounts) {
            this._reporter.sendTelemetryEvent('RunTest', null, this._runCounts);
        }

        if (this._debugCounts) {
            this._reporter.sendTelemetryEvent('DebugTest', null, this._debugCounts);
        }

        this._runCounts = undefined;
        this._debugCounts = undefined;
    }

    private _saveDirtyFiles(): Promise<boolean> {
        return Promise.resolve(
            vscode.workspace.saveAll(/*includeUntitled*/ false));
    }

    private _runTest(fileName: string, testMethod: string, testFrameworkName: string): Promise<protocol.V2.DotNetTestResult[]> {
        const request: protocol.V2.RunTestRequest = {
            FileName: fileName,
            MethodName: testMethod,
            TestFrameworkName: testFrameworkName
        };

        return serverUtils.runTest(this._server, request)
            .then(response => response.Results);
    }

    private _reportResults(results: protocol.V2.DotNetTestResult[]): Promise<void> {
        const totalTests = results.length;

        let totalPassed = 0, totalFailed = 0, totalSkipped = 0;
        for (let result of results) {
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

        const output = this._getOutputChannel();
        output.appendLine('');
        output.appendLine(`Total tests: ${totalTests}. Passed: ${totalPassed}. Failed: ${totalFailed}. Skipped: ${totalSkipped}`);
        output.appendLine('');

        return Promise.resolve();
    }

    private _runDotnetTest(testMethod: string, fileName: string, testFrameworkName: string) {
        const output = this._getOutputChannel();

        output.show();
        output.appendLine(`Running test ${testMethod}...`);
        output.appendLine('');

        const listener = this._server.onTestMessage(e => {
            output.appendLine(e.Message);
        });

        this._saveDirtyFiles()
            .then(_ => this._recordRunRequest(testFrameworkName))
            .then(_ => this._runTest(fileName, testMethod, testFrameworkName))
            .then(results => this._reportResults(results))
            .then(() => listener.dispose())
            .catch(reason => {
                listener.dispose();
                vscode.window.showErrorMessage(`Failed to run test because ${reason}.`);
            });
    }

    private _createLaunchConfiguration(program: string, args: string, cwd: string, debuggerEventsPipeName: string) {
        let debugOptions = vscode.workspace.getConfiguration('csharp').get('unitTestDebuggingOptions');

        // Get the initial set of options from the workspace setting
        let result: any;
        if (typeof debugOptions === "object") {
            // clone the options object to avoid changing it
            result = JSON.parse(JSON.stringify(debugOptions));
        } else {
            result = {};
        }

        if (!result.type) {
            result.type = "coreclr";
        }

        // Now fill in the rest of the options
        result.name = ".NET Test Launch";
        result.request = "launch";
        result.debuggerEventsPipeName = debuggerEventsPipeName;
        result.program = program;
        result.args = args;
        result.cwd = cwd;

        return result;
    }

    private _getLaunchConfigurationForVSTest(fileName: string, testMethod: string, testFrameworkName: string, debugEventListener: DebugEventListener): Promise<any> {
        const output = this._getOutputChannel();

        // Listen for test messages while getting start info.
        const listener = this._server.onTestMessage(e => {
            output.appendLine(e.Message);
        });

        const request: protocol.V2.DebugTestGetStartInfoRequest = {
            FileName: fileName,
            MethodName: testMethod,
            TestFrameworkName: testFrameworkName
        };

        return serverUtils.debugTestGetStartInfo(this._server, request)
            .then(response => {
                listener.dispose();
                return this._createLaunchConfiguration(response.FileName, response.Arguments, response.WorkingDirectory, debugEventListener.pipePath());
            });
    }

    private _getLaunchConfigurationForLegacy(fileName: string, testMethod: string, testFrameworkName: string): Promise<any> {
        const output = this._getOutputChannel();

        // Listen for test messages while getting start info.
        const listener = this._server.onTestMessage(e => {
            output.appendLine(e.Message);
        });

        const request: protocol.V2.GetTestStartInfoRequest = {
            FileName: fileName,
            MethodName: testMethod,
            TestFrameworkName: testFrameworkName
        };

        return serverUtils.getTestStartInfo(this._server, request)
            .then(response => {
                listener.dispose();
                return this._createLaunchConfiguration(response.Executable, response.Argument, response.WorkingDirectory, null);
            });
    }

    private _getLaunchConfiguration(debugType: string, fileName: string, testMethod: string, testFrameworkName: string, debugEventListener: DebugEventListener): Promise<any> {
        switch (debugType) {
            case 'legacy':
                return this._getLaunchConfigurationForLegacy(fileName, testMethod, testFrameworkName);
            case 'vstest':
                return this._getLaunchConfigurationForVSTest(fileName, testMethod, testFrameworkName, debugEventListener);

            default:
                throw new Error(`Unexpected debug type: ${debugType}`);
        }
    }

    private _debugDotnetTest(testMethod: string, fileName: string, testFrameworkName: string) {
        // We support to styles of 'dotnet test' for debugging: The legacy 'project.json' testing, and the newer csproj support
        // using VS Test. These require a different level of communication.
        let debugType: string;
        let debugEventListener: DebugEventListener = null;

        const output = this._getOutputChannel();

        output.show();
        output.appendLine(`Debugging method '${testMethod}'...`);
        output.appendLine('');

        return this._saveDirtyFiles()
            .then(_ => this._recordDebugRequest(testFrameworkName))
            .then(_ => serverUtils.requestProjectInformation(this._server, { FileName: fileName }))
            .then(projectInfo => {
                if (projectInfo.DotNetProject) {
                    debugType = 'legacy';
                    return Promise.resolve();
                }
                else if (projectInfo.MsBuildProject) {
                    debugType = 'vstest';
                    debugEventListener = new DebugEventListener(fileName, this._server, output);
                    return debugEventListener.start();
                }
                else {
                    throw new Error('Expected project.json or .csproj project.');
                }
            })
            .then(() => this._getLaunchConfiguration(debugType, fileName, testMethod, testFrameworkName, debugEventListener))
            .then(config => vscode.commands.executeCommand('vscode.startDebug', config))
            .catch(reason => {
                vscode.window.showErrorMessage(`Failed to start debugger: ${reason}`);
                if (debugEventListener != null) {
                    debugEventListener.close();
                }
            });
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
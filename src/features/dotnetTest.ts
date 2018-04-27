/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from "../omnisharp/utils";
import * as utils from '../common';
import * as vscode from 'vscode';
import AbstractProvider from './abstractProvider';
import { DebuggerEventsProtocol } from '../coreclr-debug/debuggerEventsProtocol';
import { OmniSharpServer } from '../omnisharp/server';
import { TestExecutionCountReport } from '../omnisharp/loggingEvents';
import { EventStream } from '../EventStream';
import LaunchConfiguration from './launchConfiguration';
import Disposable from '../Disposable';
import CompositeDisposable from '../CompositeDisposable';

const TelemetryReportingDelay = 2 * 60 * 1000; // two minutes

export default class TestManager extends AbstractProvider {
    private _channel: vscode.OutputChannel;

    private _runCounts: { [testFrameworkName: string]: number };
    private _debugCounts: { [testFrameworkName: string]: number };
    private _telemetryIntervalId: NodeJS.Timer = undefined;
    private _eventStream: EventStream;

    constructor(server: OmniSharpServer, eventStream: EventStream) {
        super(server);
        this._eventStream = eventStream;

        // register commands
        let d1 = vscode.commands.registerCommand(
            'dotnet.test.run',
            async (testMethod, fileName, testFrameworkName) => this._runDotnetTest(testMethod, fileName, testFrameworkName));

        let d2 = vscode.commands.registerCommand(
            'dotnet.test.debug',
            async (testMethod, fileName, testFrameworkName) => this._debugDotnetTest(testMethod, fileName, testFrameworkName));

        let d4 = vscode.commands.registerCommand(
            'dotnet.classTests.run',
            async (methodsInClass, fileName, testFrameworkName) => this._runDotnetTestsInClass(methodsInClass, fileName, testFrameworkName));

        let d5 = vscode.commands.registerCommand(
            'dotnet.classTests.debug',
            async (methodsInClass, fileName, testFrameworkName) => this._debugDotnetTestsInClass(methodsInClass, fileName, testFrameworkName));

        this._telemetryIntervalId = setInterval(() =>
            this._reportTelemetry(), TelemetryReportingDelay);

        let d3 = new Disposable(() => {
            if (this._telemetryIntervalId !== undefined) {
                // Stop reporting telemetry
                clearInterval(this._telemetryIntervalId);
                this._telemetryIntervalId = undefined;
                this._reportTelemetry();
            }
        });

        this.addDisposables(new CompositeDisposable(d1, d2, d3, d4, d5));
    }

    private _getOutputChannel(): vscode.OutputChannel {
        if (this._channel === undefined) {
            this._channel = vscode.window.createOutputChannel(".NET Test Log");
            this.addDisposables(new CompositeDisposable(this._channel));
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
        this._eventStream.post(new TestExecutionCountReport(this._debugCounts, this._runCounts));
        this._runCounts = undefined;
        this._debugCounts = undefined;
    }

    private async _saveDirtyFiles(): Promise<boolean> {
        return Promise.resolve(
            vscode.workspace.saveAll(/*includeUntitled*/ false));
    }

    private async _runTest(fileName: string, testMethod: string, testFrameworkName: string, targetFrameworkVersion: string): Promise<protocol.V2.DotNetTestResult[]> {
        const request: protocol.V2.RunTestRequest = {
            FileName: fileName,
            MethodName: testMethod,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion
        };

        return serverUtils.runTest(this._server, request)
            .then(response => response.Results);
    }

    private async _reportResults(results: protocol.V2.DotNetTestResult[]): Promise<void> {
        const totalTests = results.length;
        const output = this._getOutputChannel();

        let totalPassed = 0, totalFailed = 0, totalSkipped = 0;
        for (let result of results) {
            output.appendLine(`${result.MethodName}: ${result.Outcome}`);
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

        return Promise.resolve();
    }

    private async _recordRunAndGetFrameworkVersion(fileName: string, testFrameworkName: string) {

        await this._saveDirtyFiles();
        this._recordRunRequest(testFrameworkName);
        let projectInfo = await serverUtils.requestProjectInformation(this._server, { FileName: fileName });

        let targetFrameworkVersion: string;

        if (projectInfo.DotNetProject) {
            targetFrameworkVersion = undefined;
        }
        else if (projectInfo.MsBuildProject) {
            targetFrameworkVersion = projectInfo.MsBuildProject.TargetFramework;
        }
        else {
            throw new Error('Expected project.json or .csproj project.');
        }

        return targetFrameworkVersion;
    }

    private async _runDotnetTest(testMethod: string, fileName: string, testFrameworkName: string) {
        const output = this._getOutputChannel();

        output.show();
        output.appendLine(`Running test ${testMethod}...`);
        output.appendLine('');

        const listener = this._server.onTestMessage(e => {
            output.appendLine(e.Message);
        });

        let targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName, testFrameworkName);

        return this._runTest(fileName, testMethod, testFrameworkName, targetFrameworkVersion)
            .then(async results => this._reportResults(results))
            .then(() => listener.dispose())
            .catch(reason => {
                listener.dispose();
                vscode.window.showErrorMessage(`Failed to run test because ${reason}.`);
            });
    }

    private async _runDotnetTestsInClass(methodsInClass: string[], fileName: string, testFrameworkName: string) {
        const output = this._getOutputChannel();

        output.show();
        const listener = this._server.onTestMessage(e => {
            output.appendLine(e.Message);
        });

        let targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName, testFrameworkName);

        return this._runTestsInClass(fileName, testFrameworkName, targetFrameworkVersion, methodsInClass)
            .then(async results => this._reportResults(results))
            .then(() => listener.dispose())
            .catch(reason => {
                listener.dispose();
                vscode.window.showErrorMessage(`Failed to run tests because ${reason}.`);
            });
    }

    private async _runTestsInClass(fileName: string, testFrameworkName: string, targetFrameworkVersion: string, methodsToRun: string[]): Promise<protocol.V2.DotNetTestResult[]> {
        const request: protocol.V2.RunTestsInClassRequest = {
            FileName: fileName,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            MethodNames: methodsToRun
        };

        return serverUtils.runTestsInClass(this._server, request)
            .then(response => response.Results);
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

        let launchConfiguration: LaunchConfiguration = {
            ...result,
            type: result.type || "coreclr",
            name: ".NET Test Launch",
            request: "launch",
            debuggerEventsPipeName: debuggerEventsPipeName,
            program: program,
            args: args,
            cwd: cwd
        };


        // Now fill in the rest of the options

        return launchConfiguration;
    }

    private async _getLaunchConfigurationForVSTest(
        fileName: string,
        testMethod: string,
        testFrameworkName: string,
        targetFrameworkVersion: string,
        debugEventListener: DebugEventListener): Promise<LaunchConfiguration> {
        const output = this._getOutputChannel();

        // Listen for test messages while getting start info.
        const listener = this._server.onTestMessage(e => {
            output.appendLine(e.Message);
        });

        const request: protocol.V2.DebugTestGetStartInfoRequest = {
            FileName: fileName,
            MethodName: testMethod,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion
        };

        return serverUtils.debugTestGetStartInfo(this._server, request)
            .then(response => {
                listener.dispose();
                return this._createLaunchConfiguration(
                    response.FileName,
                    response.Arguments,
                    response.WorkingDirectory,
                    debugEventListener.pipePath());
            });
    }

    private async _getLaunchConfigurationForLegacy(fileName: string, testMethod: string, testFrameworkName: string, targetFrameworkVersion: string): Promise<LaunchConfiguration> {
        const output = this._getOutputChannel();

        // Listen for test messages while getting start info.
        const listener = this._server.onTestMessage(e => {
            output.appendLine(e.Message);
        });

        const request: protocol.V2.GetTestStartInfoRequest = {
            FileName: fileName,
            MethodName: testMethod,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion
        };

        return serverUtils.getTestStartInfo(this._server, request)
            .then(response => {
                listener.dispose();
                return this._createLaunchConfiguration(response.Executable, response.Argument, response.WorkingDirectory, null);
            });
    }

    private async _getLaunchConfiguration(
        debugType: string,
        fileName: string,
        testMethod: string,
        testFrameworkName: string,
        targetFrameworkVersion: string,
        debugEventListener: DebugEventListener): Promise<LaunchConfiguration> {
        switch (debugType) {
            case 'legacy':
                return this._getLaunchConfigurationForLegacy(fileName, testMethod, testFrameworkName, targetFrameworkVersion);
            case 'vstest':
                return this._getLaunchConfigurationForVSTest(fileName, testMethod, testFrameworkName, targetFrameworkVersion, debugEventListener);

            default:
                throw new Error(`Unexpected debug type: ${debugType}`);
        }
    }

    private async _recordDebugAndGetDebugValues(fileName: string, testFrameworkName: string, output: vscode.OutputChannel) {
        await this._saveDirtyFiles();
        this._recordDebugRequest(testFrameworkName);
        let projectInfo = await serverUtils.requestProjectInformation(this._server, { FileName: fileName });

        let debugType: string;
        let debugEventListener: DebugEventListener = null;
        let targetFrameworkVersion: string;

        if (projectInfo.DotNetProject) {
            debugType = 'legacy';
            targetFrameworkVersion = '';
        }
        else if (projectInfo.MsBuildProject) {
            debugType = 'vstest';
            targetFrameworkVersion = projectInfo.MsBuildProject.TargetFramework;
            debugEventListener = new DebugEventListener(fileName, this._server, output);
            debugEventListener.start();
        }
        else {
            throw new Error('Expected project.json or .csproj project.');
        }

        return { debugType, debugEventListener, targetFrameworkVersion };
    }

    private async _debugDotnetTest(testMethod: string, fileName: string, testFrameworkName: string) {
        // We support to styles of 'dotnet test' for debugging: The legacy 'project.json' testing, and the newer csproj support
        // using VS Test. These require a different level of communication.

        const output = this._getOutputChannel();

        output.show();
        output.appendLine(`Debugging method '${testMethod}'...`);
        output.appendLine('');

        let { debugType, debugEventListener, targetFrameworkVersion } = await this._recordDebugAndGetDebugValues(fileName, testFrameworkName, output);

        return this._getLaunchConfiguration(debugType, fileName, testMethod, testFrameworkName, targetFrameworkVersion, debugEventListener)
            .then(config => {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fileName));
                return vscode.debug.startDebugging(workspaceFolder, config);
            })
            .catch(reason => {
                vscode.window.showErrorMessage(`Failed to start debugger: ${reason}`);
                if (debugEventListener != null) {
                    debugEventListener.close();
                }
            });
    }

    private async _debugDotnetTestsInClass(methodsToRun: string[], fileName: string, testFrameworkName: string) {

        const output = this._getOutputChannel();

        let { debugType, debugEventListener, targetFrameworkVersion } = await this._recordDebugAndGetDebugValues(fileName, testFrameworkName, output);

        return await this._getLaunchConfigurationForClass(debugType, fileName, methodsToRun, testFrameworkName, targetFrameworkVersion, debugEventListener)
            .then(config => {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fileName));
                return vscode.debug.startDebugging(workspaceFolder, config);
            })
            .catch(reason => {
                vscode.window.showErrorMessage(`Failed to start debugger: ${reason}`);
                if (debugEventListener != null) {
                    debugEventListener.close();
                }
            });
    }

    private async _getLaunchConfigurationForClass(
        debugType: string,
        fileName: string,
        methodsToRun: string[],
        testFrameworkName: string,
        targetFrameworkVersion: string,
        debugEventListener: DebugEventListener): Promise<LaunchConfiguration> {
        if (debugType == 'vstest') {
            return this._getLaunchConfigurationForVSTestClass(fileName, methodsToRun, testFrameworkName, targetFrameworkVersion, debugEventListener);
        }
        throw new Error(`Unexpected debug type: ${debugType}`);
    }

    private async _getLaunchConfigurationForVSTestClass(
        fileName: string,
        methodsToRun: string[],
        testFrameworkName: string,
        targetFrameworkVersion: string,
        debugEventListener: DebugEventListener): Promise<LaunchConfiguration> {
        const output = this._getOutputChannel();

        const listener = this._server.onTestMessage(e => {
            output.appendLine(e.Message);
        });

        const request: protocol.V2.DebugTestClassGetStartInfoRequest = {
            FileName: fileName,
            MethodNames: methodsToRun,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion
        };

        return serverUtils.debugTestClassGetStartInfo(this._server, request)
            .then(response => {
                listener.dispose();
                return this._createLaunchConfiguration(response.FileName, response.Arguments, response.WorkingDirectory, debugEventListener.pipePath());
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

    public async start(): Promise<void> {

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

        return this.removeSocketFileIfExists().then(async () => {
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

    private async removeSocketFileIfExists(): Promise<void> {
        if (os.platform() === 'win32') {
            // Win32 doesn't use the file system for pipe names
            return Promise.resolve();
        }
        else {
            return utils.deleteIfExists(this._pipePath);
        }
    }
}
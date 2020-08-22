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
import { TestExecutionCountReport, ReportDotNetTestResults, DotNetTestRunStart, DotNetTestMessage, DotNetTestRunFailure, DotNetTestsInClassRunStart, DotNetTestDebugWarning, DotNetTestDebugProcessStart, DotNetTestDebugComplete, DotNetTestDebugStart, DotNetTestsInClassDebugStart, DotNetTestDebugStartFailure, DotNetTestRunInContextStart, DotNetTestDebugInContextStart } from '../omnisharp/loggingEvents';
import { EventStream } from '../EventStream';
import LaunchConfiguration from './launchConfiguration';
import Disposable from '../Disposable';
import CompositeDisposable from '../CompositeDisposable';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';

const TelemetryReportingDelay = 2 * 60 * 1000; // two minutes

export default class TestManager extends AbstractProvider {

    private _runCounts: { [testFrameworkName: string]: number };
    private _debugCounts: { [testFrameworkName: string]: number };
    private _telemetryIntervalId: NodeJS.Timer = undefined;
    private _eventStream: EventStream;

    constructor(server: OmniSharpServer, eventStream: EventStream, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
        this._eventStream = eventStream;

        // register commands
        let d1 = vscode.commands.registerCommand(
            'dotnet.test.run',
            async (testMethod, fileName, testFrameworkName) => this.runDotnetTest(testMethod, fileName, testFrameworkName));

        let d2 = vscode.commands.registerCommand(
            'dotnet.test.debug',
            async (testMethod, fileName, testFrameworkName) => this.debugDotnetTest(testMethod, fileName, testFrameworkName));

        let d4 = vscode.commands.registerCommand(
            'dotnet.classTests.run',
            async (className, methodsInClass, fileName, testFrameworkName) => this.runDotnetTestsInClass(className, methodsInClass, fileName, testFrameworkName));

        let d5 = vscode.commands.registerCommand(
            'dotnet.classTests.debug',
            async (className, methodsInClass, fileName, testFrameworkName) => this.debugDotnetTestsInClass(className, methodsInClass, fileName, testFrameworkName));

        let d6 = vscode.commands.registerTextEditorCommand(
            'dotnet.test.runTestsInContext',
            async (textEditor: vscode.TextEditor) => this._runDotnetTestsInContext(textEditor.document.fileName, textEditor.selection.active, textEditor.document.languageId));

        let d7 = vscode.commands.registerTextEditorCommand(
            'dotnet.test.debugTestsInContext',
            async (textEditor: vscode.TextEditor) => this._debugDotnetTestsInContext(textEditor.document.fileName, textEditor.document.uri, textEditor.selection.active, textEditor.document.languageId));

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

        this.addDisposables(new CompositeDisposable(d1, d2, d3, d4, d5, d6, d7));
    }

    private _recordRunRequest(testFrameworkName?: string): void {
        if (this._runCounts === undefined) {
            this._runCounts = {};
        }

        if (testFrameworkName === undefined) {
            testFrameworkName = 'context';
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

    private _recordDebugRequest(testFrameworkName?: string): void {
        if (this._debugCounts === undefined) {
            this._debugCounts = {};
        }

        if (testFrameworkName === undefined) {
            testFrameworkName = 'context';
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

    private async _runTest(fileName: string, testMethod: string, runSettings: string, testFrameworkName: string, targetFrameworkVersion: string, noBuild: boolean): Promise<protocol.V2.DotNetTestResult[]> {
        const request: protocol.V2.RunTestRequest = {
            FileName: fileName,
            MethodName: testMethod,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            NoBuild: noBuild
        };

        try {
            let response = await serverUtils.runTest(this._server, request);
            return response.Results;
        }
        catch (error) {
            return undefined;
        }
    }

    private async _recordRunAndGetFrameworkVersion(fileName: string, testFrameworkName?: string): Promise<string> {

        await this._saveDirtyFiles();
        this._recordRunRequest(testFrameworkName);
        let projectInfo: protocol.ProjectInformationResponse;
        try {
            projectInfo = await serverUtils.requestProjectInformation(this._server, { FileName: fileName });
        }
        catch (error) {
            return undefined;
        }

        let targetFrameworkVersion: string;

        if (projectInfo.MsBuildProject) {
            targetFrameworkVersion = projectInfo.MsBuildProject.TargetFramework;
        }
        else {
            throw new Error('Expected project.json or .csproj project.');
        }

        return targetFrameworkVersion;
    }

    public async discoverTests(fileName: string, testFrameworkName: string, noBuild: boolean): Promise<protocol.V2.TestInfo[]> {

        let targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName, testFrameworkName);
        let runSettings = vscode.workspace.getConfiguration('omnisharp').get<string>('testRunSettings');

        const request: protocol.V2.DiscoverTestsRequest = {
            FileName: fileName,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            NoBuild: noBuild
        };

        try {
            let response = await serverUtils.discoverTests(this._server, request);
            return response.Tests;
        }
        catch (error) {
            return undefined;
        }
    }

    private _getRunSettings(): string | undefined {
        return vscode.workspace.getConfiguration('omnisharp').get<string>('testRunSettings');
    }

    public async runDotnetTest(testMethod: string, fileName: string, testFrameworkName: string, noBuild: boolean = false) {

        this._eventStream.post(new DotNetTestRunStart(testMethod));

        const listener = this._server.onTestMessage(e => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        let targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName, testFrameworkName);
        let runSettings = this._getRunSettings();

        try {
            let results = await this._runTest(fileName, testMethod, runSettings, testFrameworkName, targetFrameworkVersion, noBuild);
            this._eventStream.post(new ReportDotNetTestResults(results));
        }
        catch (reason) {
            this._eventStream.post(new DotNetTestRunFailure(reason));
        }
        finally {
            listener.dispose();
        }
    }

    public async runDotnetTestsInClass(className: string, methodsInClass: string[], fileName: string, testFrameworkName: string, noBuild: boolean = false) {

        //to do: try to get the class name here
        this._eventStream.post(new DotNetTestsInClassRunStart(className));

        const listener = this._server.onTestMessage(e => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        let targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName, testFrameworkName);
        let runSettings = this._getRunSettings();

        try {
            let results = await this._runTestsInClass(fileName, runSettings, testFrameworkName, targetFrameworkVersion, methodsInClass, noBuild);
            this._eventStream.post(new ReportDotNetTestResults(results));
        }
        catch (reason) {
            this._eventStream.post(new DotNetTestRunFailure(reason));
        }
        finally {
            listener.dispose();
        }
    }

    private async _runTestsInClass(fileName: string, runSettings: string, testFrameworkName: string, targetFrameworkVersion: string, methodsToRun: string[], noBuild: boolean): Promise<protocol.V2.DotNetTestResult[]> {
        const request: protocol.V2.RunTestsInClassRequest = {
            FileName: fileName,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            MethodNames: methodsToRun,
            NoBuild: noBuild
        };

        let response = await serverUtils.runTestsInClass(this._server, request);
        return response.Results;
    }

    private async _runDotnetTestsInContext(fileName: string, active: vscode.Position, editorLangId: string) {
        if (editorLangId !== "csharp") {
            this._eventStream.post(new DotNetTestMessage(`${vscode.workspace.asRelativePath(fileName, false)} is not a C# file, cannot run tests`));
            return;
        }

        this._eventStream.post(new DotNetTestRunInContextStart(vscode.workspace.asRelativePath(fileName, false), active.line, active.character));

        const listener = this._server.onTestMessage(e => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        let targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName);
        let runSettings = this._getRunSettings();

        const request: protocol.V2.RunTestsInContextRequest = {
            FileName: fileName,
            Line: active.line,
            Column: active.character,
            RunSettings: runSettings,
            TargetFrameworkVersion: targetFrameworkVersion
        };

        try {
            let response = await serverUtils.runTestsInContext(this._server, request);
            if (response.ContextHadNoTests) {
                this._eventStream.post(new DotNetTestMessage(response.Failure));
            }
            else if (!response.Pass && response.Results === null) {
                this._eventStream.post(new DotNetTestRunFailure(response.Failure));
            }
            else {
                this._eventStream.post(new ReportDotNetTestResults(response.Results));
            }
        }
        catch (reason) {
            this._eventStream.post(new DotNetTestRunFailure(reason));
        }
        finally {
            listener.dispose();
        }
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
        runSettings: string,
        testFrameworkName: string,
        targetFrameworkVersion: string,
        debugEventListener: DebugEventListener,
        noBuild: boolean): Promise<LaunchConfiguration> {

        // Listen for test messages while getting start info.
        const listener = this._server.onTestMessage(e => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        const request: protocol.V2.DebugTestGetStartInfoRequest = {
            FileName: fileName,
            MethodName: testMethod,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            NoBuild: noBuild
        };

        try {
            let response = await serverUtils.debugTestGetStartInfo(this._server, request);
            return this._createLaunchConfiguration(
                response.FileName,
                response.Arguments,
                response.WorkingDirectory,
                debugEventListener.pipePath());
        }
        finally {
            listener.dispose();
        }
    }

    private async _recordDebugAndGetDebugValues(fileName: string, testFrameworkName?: string) {
        await this._saveDirtyFiles();
        this._recordDebugRequest(testFrameworkName);
        let projectInfo: protocol.ProjectInformationResponse;
        try {
            projectInfo = await serverUtils.requestProjectInformation(this._server, { FileName: fileName });
        }
        catch (error) {
            return undefined;
        }

        let debugEventListener: DebugEventListener = null;
        let targetFrameworkVersion: string;

        if (projectInfo.MsBuildProject) {
            targetFrameworkVersion = projectInfo.MsBuildProject.TargetFramework;
            debugEventListener = new DebugEventListener(fileName, this._server, this._eventStream);
            debugEventListener.start();
        }
        else {
            throw new Error('Expected .csproj project.');
        }

        return { debugEventListener, targetFrameworkVersion };
    }

    public async debugDotnetTest(testMethod: string, fileName: string, testFrameworkName: string, noBuild: boolean = false) {
        // We support to styles of 'dotnet test' for debugging: The legacy 'project.json' testing, and the newer csproj support
        // using VS Test. These require a different level of communication.

        this._eventStream.post(new DotNetTestDebugStart(testMethod));

        let { debugEventListener, targetFrameworkVersion } = await this._recordDebugAndGetDebugValues(fileName, testFrameworkName);
        let runSettings = this._getRunSettings();

        try {
            let config = await this._getLaunchConfigurationForVSTest(fileName, testMethod, runSettings, testFrameworkName, targetFrameworkVersion, debugEventListener, noBuild);
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fileName));
            return vscode.debug.startDebugging(workspaceFolder, config);
        }
        catch (reason) {
            this._eventStream.post(new DotNetTestDebugStartFailure(reason));
            if (debugEventListener !== null) {
                debugEventListener.close();
            }
        }
    }

    public async debugDotnetTestsInClass(className: string, methodsToRun: string[], fileName: string, testFrameworkName: string, noBuild: boolean = false) {

        this._eventStream.post(new DotNetTestsInClassDebugStart(className));

        let { debugEventListener, targetFrameworkVersion } = await this._recordDebugAndGetDebugValues(fileName, testFrameworkName);
        let runSettings = this._getRunSettings();

        try {
            let config = await this._getLaunchConfigurationForVSTestClass(fileName, methodsToRun, runSettings, testFrameworkName, targetFrameworkVersion, debugEventListener, noBuild);
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fileName));
            return vscode.debug.startDebugging(workspaceFolder, config);
        }
        catch (reason) {
            this._eventStream.post(new DotNetTestDebugStartFailure(reason));
            if (debugEventListener != null) {
                debugEventListener.close();
            }
        }
    }

    private async _debugDotnetTestsInContext(fileName: string, fileUri: vscode.Uri, active: vscode.Position, editorLangId: string) {
        if (editorLangId !== "csharp") {
            this._eventStream.post(new DotNetTestMessage(`${vscode.workspace.asRelativePath(fileName, false)} is not a C# file, cannot run tests`));
            return;
        }

        this._eventStream.post(new DotNetTestDebugInContextStart(vscode.workspace.asRelativePath(fileName, false), active.line, active.character));

        let { debugEventListener, targetFrameworkVersion } = await this._recordDebugAndGetDebugValues(fileName);

        let runSettings = this._getRunSettings();

        try {
            let config = await this._getLaunchConfigurationForVSTestInContext(fileName, active.line, active.character, runSettings, targetFrameworkVersion, debugEventListener);
            if (config === null) {
                return;
            }

            const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
            return vscode.debug.startDebugging(workspaceFolder, config);
        }
        catch (reason) {
            this._eventStream.post(new DotNetTestRunFailure(reason));
            if (debugEventListener !== null) {
                debugEventListener.close();
            }
        }
    }

    private async _getLaunchConfigurationForVSTestClass(
        fileName: string,
        methodsToRun: string[],
        runSettings: string,
        testFrameworkName: string,
        targetFrameworkVersion: string,
        debugEventListener: DebugEventListener,
        noBuild: boolean): Promise<LaunchConfiguration> {

        const listener = this._server.onTestMessage(e => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        const request: protocol.V2.DebugTestClassGetStartInfoRequest = {
            FileName: fileName,
            MethodNames: methodsToRun,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            NoBuild: noBuild
        };

        try {
            let response = await serverUtils.debugTestClassGetStartInfo(this._server, request);
            return this._createLaunchConfiguration(response.FileName, response.Arguments, response.WorkingDirectory, debugEventListener.pipePath());
        }
        finally {
            listener.dispose();
        }
    }

    private async _getLaunchConfigurationForVSTestInContext(
        fileName: string,
        line: number,
        column: number,
        runSettings: string,
        targetFrameworkVersion: string,
        debugEventListener: DebugEventListener): Promise<LaunchConfiguration | null> {

        const listener = this._server.onTestMessage(e => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        const request: protocol.V2.DebugTestsInContextGetStartInfoRequest = {
            FileName: fileName,
            Line: line,
            Column: column,
            RunSettings: runSettings,
            TargetFrameworkVersion: targetFrameworkVersion
        };

        try {
            let response = await serverUtils.debugTestsInContextGetStartInfo(this._server, request);
            if (!response.Succeeded) {
                if (response.ContextHadNoTests) {
                    this._eventStream.post(new DotNetTestMessage(response.FailureReason));
                }
                else {
                    this._eventStream.post(new DotNetTestRunFailure(response.FailureReason));
                }

                return null;
            }

            return this._createLaunchConfiguration(response.FileName, response.Arguments, response.WorkingDirectory, debugEventListener.pipePath());
        }
        finally {
            listener.dispose();
        }
    }
}

class DebugEventListener {
    static s_activeInstance: DebugEventListener = null;
    _fileName: string;
    _server: OmniSharpServer;
    _pipePath: string;
    _eventStream: EventStream;

    _serverSocket: net.Server;
    _isClosed: boolean = false;

    constructor(fileName: string, server: OmniSharpServer, eventStream: EventStream) {
        this._fileName = fileName;
        this._server = server;
        this._eventStream = eventStream;
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
                    this._eventStream.post(new DotNetTestDebugWarning("Invalid event received from debugger"));
                    return;
                }

                switch (event.eventType) {
                    case DebuggerEventsProtocol.EventType.ProcessLaunched:
                        let processLaunchedEvent = <DebuggerEventsProtocol.ProcessLaunchedEvent>(event);
                        this._eventStream.post(new DotNetTestDebugProcessStart(processLaunchedEvent.targetProcessId));
                        this.onProcessLaunched(processLaunchedEvent.targetProcessId);
                        break;

                    case DebuggerEventsProtocol.EventType.DebuggingStopped:
                        this._eventStream.post(new DotNetTestDebugComplete());
                        this.onDebuggingStopped();
                        break;
                }
            });

            socket.on('end', () => {
                this.onDebuggingStopped();
            });
        });

        await this.removeSocketFileIfExists();
        return new Promise<void>((resolve, reject) => {
            let isStarted: boolean = false;
            this._serverSocket.on('error', (err: Error) => {
                if (!isStarted) {
                    reject(err.message);
                } else {
                    this._eventStream.post(new DotNetTestDebugWarning(`Communications error on debugger event channel. ${err.message}`));
                }
            });

            this._serverSocket.listen(this._pipePath, () => {
                isStarted = true;
                resolve();
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

    private async onProcessLaunched(targetProcessId: number): Promise<void> {
        let request: protocol.V2.DebugTestLaunchRequest = {
            FileName: this._fileName,
            TargetProcessId: targetProcessId
        };

        const disposable = this._server.onTestMessage(e => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        try {
            await serverUtils.debugTestLaunch(this._server, request);
        }
        finally {
            disposable.dispose();
        }
    }

    private onDebuggingStopped(): void {
        if (this._isClosed) {
            return;
        }

        let request: protocol.V2.DebugTestStopRequest = {
            FileName: this._fileName
        };
        try {
            serverUtils.debugTestStop(this._server, request);
            this.close();
        }
        catch (error) {
            return;
        }
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

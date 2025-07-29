/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as protocol from '../protocol';
import * as serverUtils from '../utils';
import * as utils from '../../common';
import * as vscode from 'vscode';
import AbstractProvider from './abstractProvider';
import * as DebuggerEventsProtocol from '../../coreclrDebug/debuggerEventsProtocol';
import { OmniSharpServer } from '../server';
import {
    TestExecutionCountReport,
    ReportDotNetTestResults,
    DotNetTestRunStart,
    DotNetTestMessage,
    DotNetTestRunFailure,
    DotNetTestsInClassRunStart,
    DotNetTestDebugWarning,
    DotNetTestDebugProcessStart,
    DotNetTestDebugComplete,
    DotNetTestDebugStart,
    DotNetTestsInClassDebugStart,
    DotNetTestDebugStartFailure,
    DotNetTestRunInContextStart,
    DotNetTestDebugInContextStart,
} from '../omnisharpLoggingEvents';
import { EventStream } from '../../eventStream';
import LaunchConfiguration from './launchConfiguration';
import Disposable from '../../disposable';
import CompositeDisposable from '../../compositeDisposable';
import { LanguageMiddlewareFeature } from '../languageMiddlewareFeature';
import { commonOptions } from '../../shared/options';

const TelemetryReportingDelay = 2 * 60 * 1000; // two minutes

export default class TestManager extends AbstractProvider {
    private _runCounts?: { [testFrameworkName: string]: number };
    private _debugCounts?: { [testFrameworkName: string]: number };
    private _telemetryIntervalId?: NodeJS.Timeout = undefined;
    private _eventStream: EventStream;

    constructor(
        server: OmniSharpServer,
        eventStream: EventStream,
        languageMiddlewareFeature: LanguageMiddlewareFeature
    ) {
        super(server, languageMiddlewareFeature);
        this._eventStream = eventStream;

        // register commands
        const d1 = vscode.commands.registerCommand('dotnet.test.run', async (testMethod, fileName, testFrameworkName) =>
            this.runDotnetTest(testMethod, fileName, testFrameworkName)
        );

        const d2 = vscode.commands.registerCommand(
            'dotnet.test.debug',
            async (testMethod, fileName, testFrameworkName) =>
                this.debugDotnetTest(testMethod, fileName, testFrameworkName)
        );

        const d4 = vscode.commands.registerCommand(
            'dotnet.classTests.run',
            async (className, methodsInClass, fileName, testFrameworkName) =>
                this.runDotnetTestsInClass(className, methodsInClass, fileName, testFrameworkName)
        );

        const d5 = vscode.commands.registerCommand(
            'dotnet.classTests.debug',
            async (className, methodsInClass, fileName, testFrameworkName) =>
                this.debugDotnetTestsInClass(className, methodsInClass, fileName, testFrameworkName)
        );

        const d6 = vscode.commands.registerTextEditorCommand(
            'dotnet.test.runTestsInContext',
            async (textEditor: vscode.TextEditor) =>
                this._runDotnetTestsInContext(
                    textEditor.document.fileName,
                    textEditor.selection.active,
                    textEditor.document.languageId
                )
        );

        const d7 = vscode.commands.registerTextEditorCommand(
            'dotnet.test.debugTestsInContext',
            async (textEditor: vscode.TextEditor) =>
                this._debugDotnetTestsInContext(
                    textEditor.document.fileName,
                    textEditor.document.uri,
                    textEditor.selection.active,
                    textEditor.document.languageId
                )
        );

        this._telemetryIntervalId = setInterval(() => this._reportTelemetry(), TelemetryReportingDelay);

        const d3 = new Disposable(() => {
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
        } else {
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
        } else {
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
        return Promise.resolve(vscode.workspace.saveAll(/*includeUntitled*/ false));
    }

    private async _runTest(
        fileName: string,
        testMethod: string,
        runSettings: string | undefined,
        testFrameworkName: string,
        targetFrameworkVersion: string | undefined,
        noBuild: boolean
    ): Promise<protocol.V2.DotNetTestResult[]> {
        const request: protocol.V2.RunTestRequest = {
            FileName: fileName,
            MethodName: testMethod,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            NoBuild: noBuild,
        };

        const response = await serverUtils.runTest(this._server, request);
        return response.Results;
    }

    private async _recordRunAndGetFrameworkVersion(
        fileName: string,
        testFrameworkName?: string
    ): Promise<string | undefined> {
        await this._saveDirtyFiles();
        this._recordRunRequest(testFrameworkName);
        let projectInfo: protocol.ProjectInformationResponse;
        try {
            projectInfo = await serverUtils.requestProjectInformation(this._server, { FileName: fileName });
        } catch (_) {
            return undefined;
        }

        let targetFrameworkVersion: string;

        if (projectInfo.MsBuildProject) {
            targetFrameworkVersion = projectInfo.MsBuildProject.TargetFramework;
        } else {
            throw new Error('Expected .csproj project.');
        }

        return targetFrameworkVersion;
    }

    public async discoverTests(
        fileName: string,
        testFrameworkName: string,
        noBuild: boolean
    ): Promise<protocol.V2.TestInfo[] | undefined> {
        const targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName, testFrameworkName);
        const runSettings = this._getRunSettings(fileName);

        const request: protocol.V2.DiscoverTestsRequest = {
            FileName: fileName,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            NoBuild: noBuild,
        };

        try {
            const response = await serverUtils.discoverTests(this._server, request);
            return response.Tests;
        } catch {
            /* empty */
        }

        return undefined;
    }

    private _getRunSettings(filename: string): string | undefined {
        const testSettingsPath = commonOptions.runSettingsPath;
        if (testSettingsPath.length === 0) {
            return undefined;
        }

        if (path.isAbsolute(testSettingsPath)) {
            return testSettingsPath;
        }

        // Path is relative to the workspace. Create absolute path.
        const fileUri = vscode.Uri.file(filename);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
        if (workspaceFolder === undefined) {
            return undefined;
        }

        return path.join(workspaceFolder.uri.fsPath, testSettingsPath);
    }

    public async runDotnetTest(testMethod: string, fileName: string, testFrameworkName: string, noBuild = false) {
        this._eventStream.post(new DotNetTestRunStart(testMethod));

        const listener = this._server.onTestMessage((e) => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        const targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName, testFrameworkName);
        const runSettings = this._getRunSettings(fileName);

        try {
            const results = await this._runTest(
                fileName,
                testMethod,
                runSettings,
                testFrameworkName,
                targetFrameworkVersion,
                noBuild
            );
            this._eventStream.post(new ReportDotNetTestResults(results));
        } catch (error) {
            const message = (error as Error).message;
            this._eventStream.post(new DotNetTestRunFailure(message));
        } finally {
            listener.dispose();
        }
    }

    public async runDotnetTestsInClass(
        className: string,
        methodsInClass: string[],
        fileName: string,
        testFrameworkName: string,
        noBuild = false
    ) {
        //to do: try to get the class name here
        this._eventStream.post(new DotNetTestsInClassRunStart(className));

        const listener = this._server.onTestMessage((e) => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        const targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName, testFrameworkName);
        const runSettings = this._getRunSettings(fileName);

        try {
            const results = await this._runTestsInClass(
                fileName,
                runSettings,
                testFrameworkName,
                targetFrameworkVersion,
                methodsInClass,
                noBuild
            );
            this._eventStream.post(new ReportDotNetTestResults(results));
        } catch (error) {
            const message = (error as Error).message;
            this._eventStream.post(new DotNetTestRunFailure(message));
        } finally {
            listener.dispose();
        }
    }

    private async _runTestsInClass(
        fileName: string,
        runSettings: string | undefined,
        testFrameworkName: string,
        targetFrameworkVersion: string | undefined,
        methodsToRun: string[],
        noBuild: boolean
    ): Promise<protocol.V2.DotNetTestResult[]> {
        const request: protocol.V2.RunTestsInClassRequest = {
            FileName: fileName,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            MethodNames: methodsToRun,
            NoBuild: noBuild,
        };

        const response = await serverUtils.runTestsInClass(this._server, request);
        return response.Results;
    }

    private async _runDotnetTestsInContext(fileName: string, active: vscode.Position, editorLangId: string) {
        if (editorLangId !== 'csharp') {
            this._eventStream.post(
                new DotNetTestMessage(
                    `${vscode.workspace.asRelativePath(fileName, false)} is not a C# file, cannot run tests`
                )
            );
            return;
        }

        this._eventStream.post(
            new DotNetTestRunInContextStart(
                vscode.workspace.asRelativePath(fileName, false),
                active.line,
                active.character
            )
        );

        const listener = this._server.onTestMessage((e) => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        const targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName);
        const runSettings = this._getRunSettings(fileName);

        const request: protocol.V2.RunTestsInContextRequest = {
            FileName: fileName,
            Line: active.line,
            Column: active.character,
            RunSettings: runSettings,
            TargetFrameworkVersion: targetFrameworkVersion,
        };

        try {
            const response = await serverUtils.runTestsInContext(this._server, request);
            if (response.ContextHadNoTests) {
                this._eventStream.post(new DotNetTestMessage(response.Failure));
            } else if (!response.Pass && response.Results === null) {
                this._eventStream.post(new DotNetTestRunFailure(response.Failure));
            } else {
                this._eventStream.post(new ReportDotNetTestResults(response.Results));
            }
        } catch (error) {
            const message = (error as Error).message;
            this._eventStream.post(new DotNetTestRunFailure(message));
        } finally {
            listener.dispose();
        }
    }

    private _createLaunchConfiguration(
        program: string,
        args: string,
        cwd: string,
        environmentVariables: Map<string, string>,
        debuggerEventsPipeName: string
    ) {
        const debugOptions = commonOptions.unitTestDebuggingOptions;

        // Get the initial set of options from the workspace setting
        let result: any;
        if (typeof debugOptions === 'object') {
            // clone the options object to avoid changing it
            result = JSON.parse(JSON.stringify(debugOptions));
        } else {
            result = {};
        }

        const launchConfiguration: LaunchConfiguration = {
            ...result,
            type: result.type || 'coreclr',
            name: '.NET Test Launch',
            request: 'launch',
            debuggerEventsPipeName: debuggerEventsPipeName,
            program: program,
            args: args,
            cwd: cwd,
            env: environmentVariables,
        };

        // Now fill in the rest of the options
        return launchConfiguration;
    }

    private async _getLaunchConfigurationForVSTest(
        fileName: string,
        testMethod: string,
        runSettings: string | undefined,
        testFrameworkName: string,
        targetFrameworkVersion: string | undefined,
        debugEventListener: DebugEventListener,
        noBuild: boolean | undefined
    ): Promise<LaunchConfiguration> {
        // Listen for test messages while getting start info.
        const listener = this._server.onTestMessage((e) => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        const request: protocol.V2.DebugTestGetStartInfoRequest = {
            FileName: fileName,
            MethodName: testMethod,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            NoBuild: noBuild,
        };

        try {
            const response = await serverUtils.debugTestGetStartInfo(this._server, request);
            return this._createLaunchConfiguration(
                response.FileName,
                response.Arguments,
                response.WorkingDirectory,
                response.EnvironmentVariables,
                debugEventListener.pipePath()
            );
        } finally {
            listener.dispose();
        }
    }

    private async _recordDebugAndGetDebugValues(
        fileName: string,
        testFrameworkName?: string
    ): Promise<{ debugEventListener: DebugEventListener; targetFrameworkVersion: string }> {
        await this._saveDirtyFiles();
        this._recordDebugRequest(testFrameworkName);
        let projectInfo: protocol.ProjectInformationResponse;
        try {
            projectInfo = await serverUtils.requestProjectInformation(this._server, { FileName: fileName });
        } catch (_) {
            throw new Error('Could not determine project type.');
        }

        if (!projectInfo.MsBuildProject) {
            throw new Error('Expected .csproj project.');
        }

        const targetFrameworkVersion = projectInfo.MsBuildProject.TargetFramework;
        const debugEventListener = new DebugEventListener(fileName, this._server, this._eventStream);
        await debugEventListener.start();
        return { debugEventListener, targetFrameworkVersion };
    }

    public async debugDotnetTest(testMethod: string, fileName: string, testFrameworkName: string, noBuild = false) {
        this._eventStream.post(new DotNetTestDebugStart(testMethod));

        const { debugEventListener, targetFrameworkVersion } = await this._recordDebugAndGetDebugValues(
            fileName,
            testFrameworkName
        );
        const runSettings = this._getRunSettings(fileName);

        try {
            const config = await this._getLaunchConfigurationForVSTest(
                fileName,
                testMethod,
                runSettings,
                testFrameworkName,
                targetFrameworkVersion,
                debugEventListener,
                noBuild
            );
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fileName));
            return vscode.debug.startDebugging(workspaceFolder, config);
        } catch (error) {
            const message = (error as Error).message;
            this._eventStream.post(new DotNetTestDebugStartFailure(message));
            debugEventListener.close();
        }
    }

    public async debugDotnetTestsInClass(
        className: string,
        methodsToRun: string[],
        fileName: string,
        testFrameworkName: string,
        noBuild = false
    ) {
        this._eventStream.post(new DotNetTestsInClassDebugStart(className));

        const { debugEventListener, targetFrameworkVersion } = await this._recordDebugAndGetDebugValues(
            fileName,
            testFrameworkName
        );
        const runSettings = this._getRunSettings(fileName);

        try {
            const config = await this._getLaunchConfigurationForVSTestClass(
                fileName,
                methodsToRun,
                runSettings,
                testFrameworkName,
                targetFrameworkVersion,
                debugEventListener,
                noBuild
            );
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fileName));
            return vscode.debug.startDebugging(workspaceFolder, config);
        } catch (error) {
            const message = (error as Error).message;
            this._eventStream.post(new DotNetTestDebugStartFailure(message));
            debugEventListener.close();
        }
    }

    private async _debugDotnetTestsInContext(
        fileName: string,
        fileUri: vscode.Uri,
        active: vscode.Position,
        editorLangId: string
    ) {
        if (editorLangId !== 'csharp') {
            this._eventStream.post(
                new DotNetTestMessage(
                    `${vscode.workspace.asRelativePath(fileName, false)} is not a C# file, cannot run tests`
                )
            );
            return;
        }

        this._eventStream.post(
            new DotNetTestDebugInContextStart(
                vscode.workspace.asRelativePath(fileName, false),
                active.line,
                active.character
            )
        );

        const { debugEventListener, targetFrameworkVersion } = await this._recordDebugAndGetDebugValues(fileName);

        const runSettings = this._getRunSettings(fileName);

        try {
            const config = await this._getLaunchConfigurationForVSTestInContext(
                fileName,
                active.line,
                active.character,
                runSettings,
                targetFrameworkVersion,
                debugEventListener
            );
            if (config === null) {
                return;
            }

            const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
            return vscode.debug.startDebugging(workspaceFolder, config);
        } catch (error) {
            const message = (error as Error).message;
            this._eventStream.post(new DotNetTestRunFailure(message));
            debugEventListener.close();
        }
    }

    private async _getLaunchConfigurationForVSTestClass(
        fileName: string,
        methodsToRun: string[],
        runSettings: string | undefined,
        testFrameworkName: string,
        targetFrameworkVersion: string | undefined,
        debugEventListener: DebugEventListener,
        noBuild: boolean | undefined
    ): Promise<LaunchConfiguration> {
        const listener = this._server.onTestMessage((e) => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        const request: protocol.V2.DebugTestClassGetStartInfoRequest = {
            FileName: fileName,
            MethodNames: methodsToRun,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            NoBuild: noBuild,
        };

        try {
            const response = await serverUtils.debugTestClassGetStartInfo(this._server, request);
            return this._createLaunchConfiguration(
                response.FileName,
                response.Arguments,
                response.WorkingDirectory,
                response.EnvironmentVariables,
                debugEventListener.pipePath()
            );
        } finally {
            listener.dispose();
        }
    }

    private async _getLaunchConfigurationForVSTestInContext(
        fileName: string,
        line: number,
        column: number,
        runSettings: string | undefined,
        targetFrameworkVersion: string | undefined,
        debugEventListener: DebugEventListener
    ): Promise<LaunchConfiguration | null> {
        const listener = this._server.onTestMessage((e) => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        const request: protocol.V2.DebugTestsInContextGetStartInfoRequest = {
            FileName: fileName,
            Line: line,
            Column: column,
            RunSettings: runSettings,
            TargetFrameworkVersion: targetFrameworkVersion,
        };

        try {
            const response = await serverUtils.debugTestsInContextGetStartInfo(this._server, request);
            if (!response.Succeeded) {
                // FailureReason is populated if Succeeded is false
                if (response.ContextHadNoTests) {
                    this._eventStream.post(new DotNetTestMessage(response.FailureReason!));
                } else {
                    this._eventStream.post(new DotNetTestRunFailure(response.FailureReason!));
                }

                return null;
            }

            return this._createLaunchConfiguration(
                response.FileName,
                response.Arguments,
                response.WorkingDirectory,
                response.EnvironmentVariables,
                debugEventListener.pipePath()
            );
        } finally {
            listener.dispose();
        }
    }
}

class DebugEventListener {
    static s_activeInstance: DebugEventListener | undefined;
    _fileName: string;
    _server: OmniSharpServer;
    _pipePath: string;
    _eventStream: EventStream;

    _serverSocket: net.Server | undefined;
    _isClosed = false;

    constructor(fileName: string, server: OmniSharpServer, eventStream: EventStream) {
        this._fileName = fileName;
        this._server = server;
        this._eventStream = eventStream;

        if (os.platform() === 'win32') {
            this._pipePath = '\\\\.\\pipe\\Microsoft.VSCode.CSharpExt.TestDebugEvents' + process.pid;
        } else {
            const tmpdir = utils.getUnixTempDirectory();
            this._pipePath = path.join(tmpdir, 'ms-dotnettools.csharp-tde-' + process.pid);
        }
    }

    public async start(): Promise<void> {
        // We use our process id as part of the pipe name, so if we still somehow have an old instance running, close it.
        if (DebugEventListener.s_activeInstance !== undefined) {
            DebugEventListener.s_activeInstance.close();
        }

        DebugEventListener.s_activeInstance = this;

        const serverSocket = net.createServer((socket) => {
            socket.on('data', async (buffer) => {
                let event: DebuggerEventsProtocol.DebuggerEvent;
                try {
                    event = DebuggerEventsProtocol.decodePacket(buffer);
                } catch (_) {
                    this._eventStream.post(new DotNetTestDebugWarning('Invalid event received from debugger'));
                    return;
                }

                switch (event.eventType) {
                    case DebuggerEventsProtocol.ProcessLaunched: {
                        const processLaunchedEvent = <DebuggerEventsProtocol.ProcessLaunchedEvent>event;
                        this._eventStream.post(new DotNetTestDebugProcessStart(processLaunchedEvent.targetProcessId));
                        await this.onProcessLaunched(processLaunchedEvent.targetProcessId);
                        break;
                    }

                    case DebuggerEventsProtocol.DebuggingStopped:
                        this._eventStream.post(new DotNetTestDebugComplete());
                        await this.onDebuggingStopped();
                        break;
                }
            });

            socket.on('end', async () => {
                await this.onDebuggingStopped();
            });
        });

        // We need the local serverSocket variable for the promise to capture below,
        // or else TypeScript will warn that the instance variable could be undefined.
        this._serverSocket = serverSocket;

        await this.removeSocketFileIfExists();
        return new Promise((resolve, reject) => {
            serverSocket.on('error', (err) => {
                if (!serverSocket.listening) {
                    reject(err.message);
                } else {
                    this._eventStream.post(
                        new DotNetTestDebugWarning(`Communications error on debugger event channel. ${err.message}`)
                    );
                }
            });

            serverSocket.listen(this._pipePath, () => {
                resolve();
            });
        });
    }

    public pipePath(): string {
        return this._pipePath;
    }

    public close() {
        if (this === DebugEventListener.s_activeInstance) {
            DebugEventListener.s_activeInstance = undefined;
        }

        if (this._isClosed) {
            return;
        }

        this._isClosed = true;

        if (this._serverSocket !== undefined) {
            this._serverSocket.close();
        }
    }

    private async onProcessLaunched(targetProcessId: number): Promise<void> {
        const request: protocol.V2.DebugTestLaunchRequest = {
            FileName: this._fileName,
            TargetProcessId: targetProcessId,
        };

        const disposable = this._server.onTestMessage((e) => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        try {
            await serverUtils.debugTestLaunch(this._server, request);
        } finally {
            disposable.dispose();
        }
    }

    private async onDebuggingStopped(): Promise<void> {
        if (this._isClosed) {
            return;
        }

        const request: protocol.V2.DebugTestStopRequest = {
            FileName: this._fileName,
        };
        try {
            await serverUtils.debugTestStop(this._server, request);
            this.close();
        } catch (_) {
            return;
        }
    }

    private async removeSocketFileIfExists(): Promise<void> {
        if (os.platform() === 'win32') {
            // Win32 doesn't use the file system for pipe names
            return Promise.resolve();
        } else {
            return utils.deleteIfExists(this._pipePath);
        }
    }
}

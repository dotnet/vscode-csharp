import * as vscode from 'vscode';
import { TestAdapter, TestHub, testExplorerExtensionId, TestLoadStartedEvent, TestLoadFinishedEvent, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent, TestSuiteInfo, TestInfo, TestDecoration } from 'vscode-test-adapter-api';
import { Log, TestAdapterRegistrar } from 'vscode-test-adapter-util';
import TestManager from '../features/dotnetTest';
import * as fs from 'fs';
import * as path from 'path';
import { EventStream } from '../EventStream';
import { V2 } from '../omnisharp/protocol';
import { BaseEvent, ReportDotNetTestResults } from '../omnisharp/loggingEvents';
import { EventType } from '../omnisharp/EventType';

export class MSTestAdapter implements TestAdapter {

    private disposables: { dispose(): void }[] = [];

    private readonly testsEmitter = new vscode.EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
    private readonly testStatesEmitter = new vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>();
    private readonly autorunEmitter = new vscode.EventEmitter<void>();

    get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> { return this.testsEmitter.event; }
    get testStates(): vscode.Event<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent> { return this.testStatesEmitter.event; }
    get autorun(): vscode.Event<void> | undefined { return this.autorunEmitter.event; }

    static async register(context: vscode.ExtensionContext, eventStream: EventStream, testManager: Promise<TestManager>) {

        const workspaceRootFolder = (vscode.workspace.workspaceFolders || [])[0];

        // get the Test Explorer extension
        const testExplorerExtension = vscode.extensions.getExtension<TestHub>(testExplorerExtensionId);

        if (testExplorerExtension) {
            const testHub = testExplorerExtension.exports;

            const testManagerResult = await testManager;
            
            // create a simple logger that can be configured with the configuration variables
            // `exampleExplorer.logpanel` and `exampleExplorer.logfile`
            const log = new Log('mstestTestExplorer', workspaceRootFolder, 'MSTest Explorer Log');
            context.subscriptions.push(log);
            
            context.subscriptions.push(new TestAdapterRegistrar(
                testHub,
                wf => {
                    let sourceFile = this._findSourceFile(wf.uri.fsPath);
                    return new MSTestAdapter(wf, log, sourceFile, eventStream, testManagerResult);
                },
                log
            ));
        }
    }

    // Omnisharp requires a specific file for most of its functions, in order to find the project. It doesn't actually matter if we're referring to tests inside
    // that particular file.
    constructor(
        public readonly workspace: vscode.WorkspaceFolder,
        private readonly log: Log,
        private readonly sourceFile: string,
        eventStream: EventStream,
        private readonly testManager: TestManager
    ) {

        this.log.info('Initializing example adapter');

        this.disposables.push(this.testsEmitter);
        this.disposables.push(this.testStatesEmitter);
        this.disposables.push(this.autorunEmitter);
        let subscription = eventStream.subscribe(event => this._handleEvent(event));
        this.disposables.push({ dispose() { subscription.unsubscribe() } });
    }

    async load(): Promise<void> {
        this.log.info('Loading MSTest tests');
        this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });
        
        let tests = await this.testManager.discoverTests(this.sourceFile, "mstest");
        let suite = this._loadTestSuite(tests);

        this.testsEmitter.fire(<TestLoadFinishedEvent>{ type: 'finished', suite: suite });
    }

    async run(tests: string[]): Promise<void> {

        this.log.info(`Running tests ${JSON.stringify(tests)}`);

        this.testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started', tests });

        await this.testManager.runDotnetTestsInClass('', tests, this.sourceFile, 'mstest' );

        this.testStatesEmitter.fire(<TestRunFinishedEvent>{ type: 'finished' });

    }

    async debug(tests: string[]): Promise<void> {
        this.log.info(`Running and debugging tests ${JSON.stringify(tests)}`);

        this.testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started', tests });

        await this.testManager.debugDotnetTestsInClass('', tests, this.sourceFile, 'mstest' );

        this.testStatesEmitter.fire(<TestRunFinishedEvent>{ type: 'finished' });
    }


    cancel(): void {
        // in a "real" TestAdapter this would kill the child process for the current test run (if there is any)
        throw new Error("Method not implemented.");
    }

    dispose(): void {
        this.cancel();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
    
    private static _findSourceFile(directory: string): string {
        
        let files = fs.readdirSync(directory, { withFileTypes: true });
        let sourceFile = files.find(file => {
            if (file.isFile() && path.extname(file.name) === '.cs') {
                return true;
            }
        });

        if (sourceFile) {
            return path.join(directory, sourceFile.name);
        }

        let subDirectorySourceFile: string;
        files.find(file => {
            if (file.isDirectory()) {
                subDirectorySourceFile = this._findSourceFile(path.join(directory, file.name));
                if (sourceFile) {
                    return true;
                }
            }
        });

        if (subDirectorySourceFile)
        {
            return path.join(directory, subDirectorySourceFile);
        }
    }

    private _loadTestSuite(tests: V2.TestInfo[]) : TestSuiteInfo {

        let suite: TestSuiteInfo;
        if (tests && tests.length > 0) {

            suite = <TestSuiteInfo> {
                type: 'suite',
                id: this.workspace.name,
                label: this.workspace.name,
            };

            let testGroups: { [key: string]: V2.TestInfo[]; } = {};
            testGroups = tests.reduce<any>((rv : any, x: V2.TestInfo) => {
                (rv[x.CodeFilePath] = rv[x.CodeFilePath] || []).push(x);
                return rv;
            }, {});
            
            suite.children = Object.values(testGroups).map(testGroup => {
                let testClassSuite = <TestSuiteInfo> {
                    type: 'suite',
                    id: testGroup[0].CodeFilePath,
                    label: path.relative(this.workspace.uri.fsPath, testGroup[0].CodeFilePath)
                };

                testClassSuite.children = testGroup.map(o => {
                    return <TestInfo>{
                        type: 'test',
                        id: o.FullyQualifiedName,
                        label: o.DisplayName,
                        file: o.CodeFilePath,
                        line: o.LineNumber
                    };
                });

                return testClassSuite;
            });
        }
        return suite;
    }

    private _handleEvent(event: BaseEvent): void {
        switch (event.type) {
            case EventType.ReportDotNetTestResults:
                this._handleReportDotnetTestResults((<ReportDotNetTestResults>event).results);
                break;
        }
    }
    
    private _handleReportDotnetTestResults(results: V2.DotNetTestResult[]) {

        results.forEach(result => {

            let testEvent = <TestEvent> {
                type: 'test',
                test: result.MethodName,
                state: result.Outcome
            };

            if (result.Outcome === V2.TestOutcomes.Failed) {
                testEvent.message = result.ErrorMessage;
                testEvent.decorations.push(<TestDecoration> {
                    line: result.ErrorStackTrace.length,
                    message: result.ErrorStackTrace
                });
            }
            else {
                testEvent.message = 'Passed';
            }

            this.testStatesEmitter.fire(testEvent);
        });
    }
}

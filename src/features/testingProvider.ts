/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import CompositeDisposable from "../CompositeDisposable";
import AbstractProvider from "./abstractProvider";
import OptionProvider from "../observers/OptionProvider";
import { LanguageMiddlewareFeature } from "../omnisharp/LanguageMiddlewareFeature";
import {
    MSBuildProject,
    ProjectInformationResponse,
    TargetFramework,
    V2,
} from "../omnisharp/protocol";
import { OmniSharpServer } from "../omnisharp/server";
import * as serverUtils from "../omnisharp/utils";
import TestManager from "./dotnetTest";
import { Subject } from "rxjs";
import {
    buffer,
    concatMap,
    debounceTime,
    distinct,
    filter,
    mergeMap,
} from "rxjs/operators";
import Disposable from "../Disposable";
import { CancellationTokenSource } from "vscode-languageserver-protocol";
import { EventStream } from "../EventStream";
import {
    DotNetTestDiscoveryResult,
    DotNetTestDiscoveryStart,
} from "../omnisharp/loggingEvents";
import Structure = V2.Structure;
import SymbolKinds = V2.SymbolKinds;
import SymbolPropertyNames = V2.SymbolPropertyNames;
import SymbolRangeNames = V2.SymbolRangeNames;

export default class TestingProvider extends AbstractProvider {
    private readonly _testAssemblies: Map<string, TestAssembly> = new Map<
        string,
        TestAssembly
    >();

    public controller: vscode.TestController;

    private readonly _fileChangeDebouncer = new Subject<string>();
    private readonly _fileSaveDebouncer = new Subject<string>();

    private readonly _projectChangedDebouncer = new Subject<MSBuildProject>();

    constructor(
        private readonly _optionProvider: OptionProvider,
        private readonly _eventStream: EventStream,
        public readonly testManager: TestManager,
        server: OmniSharpServer,
        languageMiddlewareFeature: LanguageMiddlewareFeature
    ) {
        super(server, languageMiddlewareFeature);
        this.controller = vscode.tests.createTestController(
            "ms-dotnettools:csharp",
            ".Net Test Explorer"
        );
        const flushFiles = this._fileChangeDebouncer.pipe(debounceTime(1500));
        const s1 = this._fileChangeDebouncer
            .pipe(
                filter((x) => x.endsWith(".cs")),
                distinct(null, flushFiles),
                buffer(flushFiles),
                filter((x) => x.length > 0),
                mergeMap(async (files) => this._reportFileChanges(files))
            )
            .subscribe();
        const flushSaved = this._fileSaveDebouncer.pipe(debounceTime(1500));
        const s2 = this._fileSaveDebouncer
            .pipe(
                filter((x) => x.endsWith(".cs")),
                distinct(null, flushSaved),
                buffer(flushSaved),
                filter((x) => x.length > 0),
                mergeMap(async (files) => this._reportFileSaves(files))
            )
            .subscribe();
        const flushProjects = this._projectChangedDebouncer.pipe(
            debounceTime(1500)
        );
        const s3 = this._projectChangedDebouncer
            .pipe(
                // TODO this is obviously a bad idea
                filter((x) => x.AssemblyName.endsWith("Tests")),
                distinct((x) => x.Path, flushProjects),
                concatMap(async (project) => this._reportProject(project))
            )
            .subscribe();
        const d1 = this.controller.createRunProfile(
            "Run Tests",
            vscode.TestRunProfileKind.Run,
            this._processRunRequest
        );
        const d2 = this.controller.createRunProfile(
            "Debug Tests",
            vscode.TestRunProfileKind.Debug,
            this._processDebugRequest
        );
        const d3 = server.onProjectChange(
            (p) => void this.reportProject(p.MsBuildProject)
        );
        const d4 = server.onProjectAdded(
            (p) => void this.reportProject(p.MsBuildProject)
        );
        const d5 = server.onProjectRemoved(
            (p) => void this.reportProject(p.MsBuildProject)
        );
        const d6 = vscode.workspace.onDidChangeTextDocument(
            (e) => void this.reportFileChange(e.document.fileName)
        );
        const d7 = vscode.workspace.onDidSaveTextDocument(
            (e) => void this.reportFileSave(e.fileName)
        );
        const d8 = vscode.workspace.onDidDeleteFiles(
            (e) => void this.reportFileDeletes(e.files.map((x) => x.path))
        );
        this.addDisposables(
            new CompositeDisposable(
                this.controller,
                d1,
                d2,
                d3,
                d4,
                d5,
                d6,
                d7,
                d8,
                new Disposable(s1),
                new Disposable(s2),
                new Disposable(s3)
            )
        );
    }

    public resolveTestCase(assembly: string, id: string): TestCase | undefined {
        return this._testAssemblies.get(assembly)?.discoveredTests.get(id);
    }

    public getAllTestCases(): TestCase[] {
        const testCase = [];
        for (const assembly of this._testAssemblies.values()) {
            testCase.push(...assembly.discoveredTests.values());
        }
        return testCase;
    }

    public reportFileChange(fileName: string) {
        this._fileChangeDebouncer.next(fileName);
    }

    public reportFileSave(fileName: string) {
        this._fileSaveDebouncer.next(fileName);
    }

    public reportFileDeletes(fileNames: string[]) {
        const uniqueFileNames = new Set(
            fileNames.filter((x) => x.endsWith(".cs"))
        );
        if (uniqueFileNames.size > 0) {
            for (const assembly of this._testAssemblies.values()) {
                let hasChanged = false;
                for (const test of assembly.discoveredTests.values()) {
                    if (uniqueFileNames.has(test.CodeFilePath)) {
                        hasChanged = true;
                        assembly.discoveredTests.delete(test.id);
                    }
                }
                if (hasChanged) {
                    this._upsertAssemblyOnController(assembly);
                }
            }
        }
    }

    private async _reportFileChanges(fileNames: string[]): Promise<void> {
        const inspector = await TestFileInspector.load(this._server, fileNames);
        const testFiles = inspector.getAllTests();

        for (const fileName of new Set(fileNames)) {
            let projectInfo: ProjectInformationResponse;
            try {
                projectInfo = await serverUtils.requestProjectInformation(
                    this._server,
                    { FileName: fileName }
                );
            } catch (error) {
                return undefined;
            }

            this._tryUpdateTestFile(projectInfo, fileName, testFiles);
        }
    }

    private async _reportFileSaves(fileNames: string[]): Promise<void> {
        const inspector = await TestFileInspector.load(this._server, fileNames);
        const testFiles = inspector.getAllTests();

        for (const fileName of new Set(fileNames)) {
            let projectInfo: ProjectInformationResponse;
            try {
                projectInfo = await serverUtils.requestProjectInformation(
                    this._server,
                    { FileName: fileName }
                );
            } catch (error) {
                return undefined;
            }

            if (!this._tryUpdateTestFile(projectInfo, fileName, testFiles)) {
                this.reportProject(projectInfo.MsBuildProject);
            }
        }
    }

    private _tryUpdateTestFile(
        projectInfo: ProjectInformationResponse,
        fileName: string,
        testFiles: TestInfo[]
    ): boolean {
        const assembly = this._testAssemblies.get(
            projectInfo.MsBuildProject.AssemblyName
        );
        if (!assembly) {
            return false;
        }
        const testsFromThisFile = [...assembly.discoveredTests.values()]
            .filter((x) => x.CodeFilePath == fileName)
            .sort((x, y) =>
                x.FullyQualifiedName.localeCompare(y.FullyQualifiedName)
            );
        const testFromInspector = testFiles
            .filter((x) => x.fileName == fileName)
            .sort((x, y) => x.testMethodName.localeCompare(y.testMethodName));

        if (testsFromThisFile.length != testFromInspector.length) {
            return false;
        }

        for (let i = 0; i < testFromInspector.length; i++) {
            if (
                testsFromThisFile[i].FullyQualifiedName !=
                testFromInspector[i].testMethodName
            ) {
                return false;
            }
            testsFromThisFile[i].discoveryInfo = testFromInspector[i];
        }

        this._upsertAssemblyOnController(assembly);
        return true;
    }

    public async removeProject(project: MSBuildProject): Promise<void> {
        this._testAssemblies.delete(project.AssemblyName);
        this.controller.items.delete(project.AssemblyName);
    }

    public reportProject(project: MSBuildProject) {
        this._projectChangedDebouncer.next(project);
    }

    private async _discoverTests(
        fileName: string,
        testFramework: string,
        targetFramework: string
    ) {
        let testInfo: V2.TestInfo[] | undefined = undefined;
        try {
            testInfo = await this.testManager.discoverTests(
                fileName,
                testFramework,
                false,
                targetFramework
            );
        } catch {}
        if (testInfo == undefined) {
            testInfo = await this.testManager.discoverTests(
                fileName,
                testFramework,
                true,
                targetFramework
            );
        }

        return testInfo;
    }

    private async _reportProject(project: MSBuildProject): Promise<void> {
        if ((project.SourceFiles?.length ?? 0) == 0) {
            return;
        }

        this._eventStream.post(
            new DotNetTestDiscoveryStart(project.AssemblyName)
        );

        let testInfo: (V2.TestInfo & { targetFramework: string })[] = [];

        const start = Date.now();
        await Promise.all(
            project.TargetFrameworks.map(async (targetFramework) => {
                testInfo.push(
                    ...(
                        await this._discoverTests(
                            project.SourceFiles[0],
                            "xunit",
                            mapTargetFramework(targetFramework)
                        )
                    ).map((x) => ({
                        ...x,
                        targetFramework: targetFramework.ShortName,
                    }))
                );
            })
        );

        const name = project.AssemblyName;
        const discoveredTests = new Map<string, TestCase>();
        const inspector = await TestFileInspector.load(
            this._server,
            testInfo.map((x) => x.CodeFilePath).filter((x) => !!x)
        );
        if (testInfo.length > 0) {
            testInfo.forEach((element) => {
                const testCase = this._createTestCase(
                    name,
                    element,
                    inspector,
                    element.targetFramework
                );
                discoveredTests.set(testCase.id, testCase);
            });
            const assembly = {
                name,
                discoveredTests,
                targetFrameworks: project.TargetFrameworks,
            };
            this._testAssemblies.set(name, assembly);
            this._upsertAssemblyOnController(assembly);
        }
        this._eventStream.post(
            new DotNetTestDiscoveryResult(
                name,
                discoveredTests.size,
                Date.now() - start
            )
        );
    }

    private _processRunRequest = async (
        request: vscode.TestRunRequest,
        token: vscode.CancellationToken
    ) => {
        const runner = TestRunner.create(
            this,
            this.controller,
            request,
            this._server
        );
        await runner.executeTests(
            this._optionProvider.GetLatestOptions().testMaxDegreeOfParallelism,
            token
        );
    };

    private _processDebugRequest = async (
        request: vscode.TestRunRequest,
        token: vscode.CancellationToken
    ) => {
        const runner = TestRunner.create(
            this,
            this.controller,
            request,
            this._server
        );
        await runner.debugTests(token);
    };

    private _upsertAssemblyOnController(assembly: TestAssembly): void {
        const assemblyTestCollection = this.controller.createTestItem(
            assembly.name,
            assembly.name
        );
        assembly.targetFrameworks.map((targetFramework) => {
            let collection: vscode.TestItem;
            if (assembly.targetFrameworks.length == 1) {
                collection = assemblyTestCollection;
            } else {
                collection = this.controller.createTestItem(
                    targetFramework.ShortName,
                    targetFramework.ShortName
                );
                assemblyTestCollection.children.add(collection);
            }

            this._mapTreeToTestItems(
                collection,
                this._buildTestTree(
                    Array.from(assembly.discoveredTests.values()).filter(
                        (x) => x.targetFramework == targetFramework.ShortName
                    )
                )
            );
        });
        this.controller.items.add(assemblyTestCollection);
    }

    private _createTestCase(
        assembly: string,
        testInfo: V2.TestInfo,
        inspector: TestFileInspector,
        targetFramework: string
    ): TestCase {
        const discoveryInfo = inspector.getTestInfo(
            testInfo.FullyQualifiedName
        );
        return {
            id: `${assembly}/${testInfo.FullyQualifiedName}/${targetFramework}`,
            ...testInfo,
            assembly,
            discoveryInfo,
            targetFramework,
            testFramework: discoveryInfo?.testFramework ?? "xunit",
            nameSegments: this._parseName(testInfo.DisplayName),
        };
    }

    private _parseName(name: string): string[] {
        const segments = [];
        while (name.indexOf(".") != -1) {
            const indexOfDot = name.indexOf(".");
            const indexOfBracket = name.indexOf("(");
            if (indexOfBracket != -1 && indexOfBracket < indexOfDot) {
                break;
            } else {
                const segement = name.substring(0, indexOfDot);
                if (segement.length > 0) {
                    segments.push(segement);
                }
                name = name.substring(indexOfDot + 1);
            }
        }

        // Omnisharp does not support the execution of a single theory element, so we will just
        // report it as one
        const indexOfBracket = name.indexOf("(");
        if (indexOfBracket != -1) {
            name = name.substring(0, indexOfBracket);
        }
        segments.push(name);
        return segments;
    }

    private _buildTestTree(testCases: TestCase[]): TestTreeNode {
        const root: TestTreeNode = { kind: "node", children: {} };
        for (const testCase of testCases) {
            let currentNode = root;
            for (let i = 0; i < testCase.nameSegments.length; i++) {
                if (i == testCase.nameSegments.length - 1) {
                    currentNode.children[testCase.nameSegments[i]] = testCase;
                } else {
                    const child =
                        currentNode.children[testCase.nameSegments[i]];
                    if (child == undefined) {
                        const newNode: TestTreeNode = {
                            kind: "node",
                            children: {},
                        };
                        currentNode.children[testCase.nameSegments[i]] =
                            newNode;
                        currentNode = newNode;
                    } else if (isNode(child)) {
                        currentNode = child;
                    }
                }
            }
        }

        return root;
    }

    private _mapTreeToTestItems(
        testItem: vscode.TestItem,
        tree: TestTreeNode,
        prefix: string = undefined
    ): vscode.TestItem {
        const keys = Object.keys(tree.children);
        if (keys.length == 1) {
            const child = tree.children[keys[0]];
            if (isNode(child)) {
                return this._mapTreeToTestItems(
                    testItem,
                    child,
                    prefix != undefined ? prefix + "." + keys[0] : keys[0]
                );
            }
        }
        for (const nameOfChildren in tree.children) {
            const child = tree.children[nameOfChildren];
            const name =
                prefix != undefined
                    ? prefix + "." + nameOfChildren
                    : nameOfChildren;

            if (isNode(child)) {
                const childTestItem = this.controller.createTestItem(
                    name,
                    name
                );
                testItem.children.add(childTestItem);
                this._mapTreeToTestItems(childTestItem, child);
            } else {
                const childTestItem = this.controller.createTestItem(
                    child.id,
                    name,
                    child.CodeFilePath
                        ? vscode.Uri.parse("file://" + child.CodeFilePath)
                        : undefined
                );

                if (child.discoveryInfo?.range) {
                    childTestItem.range = new vscode.Range(
                        child.discoveryInfo.range.Start.Line,
                        child.discoveryInfo.range.Start.Column,
                        child.discoveryInfo.range.End.Line,
                        child.discoveryInfo.range.End.Column
                    );
                } else {
                    childTestItem.range = new vscode.Range(
                        child.LineNumber,
                        0,
                        child.LineNumber,
                        0
                    );
                }

                if (childTestItem.uri == undefined) {
                    childTestItem.error =
                        "OmniSharp did not provide a file name";
                }

                testItem.children.add(childTestItem);
            }
        }
        return testItem;
    }
}

class TestRunner {
    private constructor(
        private readonly _testAapter: TestingProvider,
        private readonly _testRun: vscode.TestRun,
        private readonly _request: vscode.TestRunRequest,
        private readonly _server: OmniSharpServer
    ) {}

    public async executeTests(
        maxDegreeOfParallelism: number,
        token: vscode.CancellationToken
    ): Promise<void> {
        const combinationTokenSource = new CancellationTokenSource();
        token.onCancellationRequested(() => combinationTokenSource.cancel());
        this._testRun.token.onCancellationRequested(() =>
            combinationTokenSource.cancel()
        );
        const testItemsToExecute = this._extractTestItemsFromRequest();
        testItemsToExecute.forEach(this._testRun.enqueued);
        const executableTests = this._createExecutableTests(testItemsToExecute);
        const testQueue = TestQueue.create(executableTests);

        const workers: Promise<void>[] = [];

        const listener = this._server.onTestMessage((e) => {
            this._testRun.appendOutput(`${e.Message}\n\r`);
        });

        try {
            for (let i = 0; i < maxDegreeOfParallelism; i++) {
                workers.push(
                    this._createBatchExecutor(
                        testQueue,
                        combinationTokenSource.token
                    )
                );
            }

            await Promise.all(workers);
        } finally {
            this._testRun.end();
            listener.dispose();
        }
    }

    public async debugTests(token: vscode.CancellationToken): Promise<void> {
        const testItemsToExecute = this._extractTestItemsFromRequest();
        const executableTests = this._createExecutableTests(testItemsToExecute);
        const testQueue = TestQueue.create(executableTests);

        try {
            while (!testQueue.isEmpty() && !token.isCancellationRequested) {
                const batch = testQueue.dequeueBatch();
                const firstFileName = batch.tests
                    .map((x) => x.testCase.CodeFilePath)
                    .filter((x) => !!x)?.[0];
                if (!firstFileName) {
                    return;
                }
                await this._testAapter.testManager.debugDotnetTestsInClass(
                    "",
                    batch.tests.map(
                        (assembly) => assembly.testCase.FullyQualifiedName
                    ),
                    firstFileName,
                    batch.testFramework
                );
            }
        } finally {
            this._testRun.end();
        }
    }

    private async _createBatchExecutor(
        queue: TestQueue,
        token: vscode.CancellationToken
    ): Promise<void> {
        let batch = queue.dequeueBatch();

        while (batch && !token.isCancellationRequested) {
            // omnisharp does lookup the project based on a file name.
            // we only need to provide a single file name to execute all the tests in an assembly.
            let fileName = batch.tests
                .filter((x) => !!x.testCase.CodeFilePath)
                .map((x) => x.testCase.CodeFilePath)[0];
            if (!fileName) {
                batch.tests.forEach(({ testItem }) =>
                    this._testRun.failed(
                        testItem,
                        new vscode.TestMessage(
                            "Omnisharp could not resolve file name"
                        )
                    )
                );
                return;
            }

            batch.tests.forEach(({ testItem }) =>
                this._testRun.started(testItem)
            );

            try {
                const results =
                    await this._testAapter.testManager.runDotnetTestsInClass(
                        "",
                        batch.tests.map((x) => x.testCase.FullyQualifiedName),
                        fileName,
                        batch.testFramework
                    );

                results.forEach((result) =>
                    this._reportTestResult(result, queue)
                );
            } catch (reason) {
                batch.tests.forEach(({ testItem }) =>
                    this._testRun.failed(
                        testItem,
                        new vscode.TestMessage(reason.toString())
                    )
                );
            }

            batch = queue.dequeueBatch();
        }
    }

    private _reportTestResult(result: V2.DotNetTestResult, queue: TestQueue) {
        const testItem = queue.getTestItemByMethodName(result.MethodName);

        if (!testItem) {
            return;
        }

        switch (result.Outcome) {
            case V2.TestOutcomes.None:
                this._testRun.failed(
                    testItem,
                    new vscode.TestMessage("No test result received")
                );
                break;
            case V2.TestOutcomes.Passed:
                this._testRun.passed(testItem);
                break;
            case V2.TestOutcomes.Failed:
                this._testRun.failed(
                    testItem,
                    new vscode.TestMessage(
                        `${result.ErrorMessage}\n\r${result.ErrorStackTrace}`
                    )
                );
                break;
            case V2.TestOutcomes.Skipped:
                this._testRun.skipped(testItem);
                break;
            case V2.TestOutcomes.NotFound:
                this._testRun.failed(
                    testItem,
                    new vscode.TestMessage("Test not found")
                );
                break;
        }
    }

    /**
     * Extract all executable {@link TestItem} from the request
     * @returns a flat list of items without collections
     */
    private _extractTestItemsFromRequest(): vscode.TestItem[] {
        const included = this._request.include ?? [];
        const excludedIds = new Set(
            (this._request.exclude ?? []).map((x) => x.id)
        );
        return this._extractTestItems(included, excludedIds);
    }

    /**
     * Extract all executable {@link TestItem} and ignores the exluded ones
     * @returns a flat list of items without collections
     */
    private _extractTestItems(
        include: vscode.TestItem[],
        excludedIds: Set<string>
    ): vscode.TestItem[] {
        let result: vscode.TestItem[] = [];
        for (const item of include) {
            if (excludedIds.has(item.id)) {
                continue;
            }
            if (item.children.size) {
                let children: vscode.TestItem[] = [];
                item.children.forEach((x) => children.push(x));
                result = [
                    ...result,
                    ...this._extractTestItems(children, excludedIds),
                ];
            } else {
                result.push(item);
            }
        }
        return result;
    }

    /**
     * Takes a list of {@link vscode.TestItem} and resolves the corresponding {@link TestCase}
     * @param items create items
     * @returns a list of {@link TestCase}
     */
    private _createExecutableTests(items: vscode.TestItem[]): ExecutableTest[] {
        return items
            .map((testItem) => {
                const [assembly] = testItem.id.split("/", 3);
                const testCase = this._testAapter.resolveTestCase(
                    assembly,
                    testItem.id
                );
                return ExecutableTest.create(testCase, testItem);
            })
            .filter((x) => !!x.testCase); // ensure that the test case is resolved
    }

    public static create(
        unitTestManager: TestingProvider,
        controller: vscode.TestController,
        request: vscode.TestRunRequest,
        server: OmniSharpServer
    ): TestRunner {
        const testRun: vscode.TestRun = controller.createTestRun(request);
        return new TestRunner(unitTestManager, testRun, request, server);
    }
}

class TestQueue {
    private readonly _testsLookup = new Map<string, ExecutableTest>();

    private constructor(private readonly _batches: TestBatch[]) {
        _batches.forEach((b) =>
            b.tests.forEach((t) =>
                this._testsLookup.set(t.testCase.FullyQualifiedName, t)
            )
        );
    }

    public isEmpty() {
        return this._batches.length == 0;
    }

    public dequeueBatch(): TestBatch | undefined {
        return this._batches.splice(0, 1)[0];
    }

    public getTestItemByMethodName(
        methodName: string
    ): vscode.TestItem | undefined {
        return this._testsLookup.get(methodName)?.testItem;
    }

    public static create(tests: ExecutableTest[]): TestQueue {
        const batches = this._createBatches(tests);
        return new TestQueue(batches);
    }

    /**
     * Groups {@link ExecutableTest} by the assemlby
     * @returns a record with the assembly name as key and a list of tests as the value
     */
    private static _createBatches(items: ExecutableTest[]): TestBatch[] {
        const batches: TestBatch[] = [];
        groupBy(items, (x) => x.testCase.testFramework)
            .map((x) => groupBy(x, (y) => y.testCase.assembly))
            .forEach((byFramework) => {
                byFramework
                    .filter((x) => x.length > 0)
                    .forEach((byAssembly) =>
                        batches.push({
                            testFramework: byAssembly[0].testCase.testFramework,
                            assemblyName: byAssembly[0].testCase.assembly,
                            tests: byAssembly,
                        })
                    );
            });
        return batches;
    }
}

const groupBy = <T>(items: T[], selector: (t: T) => string) => {
    return Object.values(
        items.reduce<Record<string, T[]>>((pr, cur) => {
            const key = selector(cur);
            if (!pr[key]) {
                pr[key] = [];
            }
            pr[key].push(cur);
            return pr;
        }, {})
    );
};

class ExecutableTest {
    private constructor(
        readonly testCase: TestCase,
        readonly testItem: vscode.TestItem
    ) {}

    public static create(
        testCase: TestCase,
        testItem: vscode.TestItem
    ): ExecutableTest {
        return new ExecutableTest(testCase, testItem);
    }
}

interface TestBatch {
    assemblyName: string;
    testFramework: string;
    tests: ExecutableTest[];
}

interface TestAssembly {
    name: string;
    discoveredTests: Map<string, TestCase>;
    targetFrameworks: TargetFramework[];
}

interface TestCase extends V2.TestInfo {
    id: string;
    assembly: string;
    nameSegments: string[];
    discoveryInfo?: TestDiscoveryInfo;
    testFramework: string;
    targetFramework: string;
}

interface TestTreeNode {
    kind: "node";
    children: Record<string, TestCase | TestTreeNode>;
}

const isNode = (node: TestCase | TestTreeNode): node is TestTreeNode =>
    "kind" in node;

class TestFileInspector {
    /**
     *
     */
    constructor(
        private readonly _loadedFiles: Map<string, TestFile>,
        private readonly _loadedTests: Map<string, TestInfo>
    ) {}

    public getAllTests() {
        return [...this._loadedTests.values()];
    }

    public getTestInfo(methodName: string) {
        return this._loadedTests.get(methodName);
    }
    public getFileInfo(name: string) {
        return this._loadedFiles.get(name);
    }
    public static async load(
        server: OmniSharpServer,
        fileNames: string[]
    ): Promise<TestFileInspector> {
        const token = new CancellationTokenSource().token;
        const loadedFiles = new Map<string, TestFile>();
        const loadedTests = new Map<string, TestInfo>();
        const filesToLoad = [...new Set(fileNames)];

        await Promise.all(
            filesToLoad.map(async (file) => {
                const structure = await serverUtils.codeStructure(
                    server,
                    {
                        FileName: file,
                    },
                    token
                );
                Structure.walkCodeElements(structure.Elements, (e) => {
                    for (const info of TestFileInspector._createTestInfo(
                        file,
                        e
                    )) {
                        if ("name" in info) {
                            loadedFiles.set(info.name, info);
                        } else {
                            loadedTests.set(info.testMethodName, info);
                        }
                    }
                });
            })
        );
        return new TestFileInspector(loadedFiles, loadedTests);
    }
    private static _isValidClassForTestCodeLens(
        element: Structure.CodeElement
    ): boolean {
        if (element.Kind != SymbolKinds.Class) {
            return false;
        }

        if (!element.Children) {
            return false;
        }

        return (
            element.Children.find(
                TestFileInspector._isValidMethodForTestCodeLens
            ) !== undefined
        );
    }

    private static _isValidMethodForTestCodeLens(
        element: Structure.CodeElement
    ): boolean {
        if (element.Kind != SymbolKinds.Method) {
            return false;
        }

        if (
            !element.Properties ||
            !element.Properties[SymbolPropertyNames.TestFramework] ||
            !element.Properties[SymbolPropertyNames.TestMethodName]
        ) {
            return false;
        }

        return true;
    }

    private static _getTestFrameworkAndMethodName(
        element: Structure.CodeElement
    ): [string, string] {
        if (!element.Properties) {
            return [null, null];
        }

        const testFramework =
            element.Properties[SymbolPropertyNames.TestFramework];
        const testMethodName =
            element.Properties[SymbolPropertyNames.TestMethodName];

        return [testFramework, testMethodName];
    }

    private static _createTestInfo(
        fileName: string,
        element: Structure.CodeElement
    ): TestDiscoveryInfo[] {
        const results: TestDiscoveryInfo[] = [];

        if (TestFileInspector._isValidMethodForTestCodeLens(element)) {
            let [testFramework, testMethodName] =
                TestFileInspector._getTestFrameworkAndMethodName(element);
            let range = element.Ranges[SymbolRangeNames.Name];

            if (range && testFramework && testMethodName) {
                const info: TestInfo = {
                    range,
                    testFramework,
                    testMethodName,
                    fileName,
                    kind: "method",
                };
                results.push(info);
            }
        } else if (TestFileInspector._isValidClassForTestCodeLens(element)) {
            // Note: We don't handle multiple test frameworks in the same class. The first test framework wins.
            let testFramework: string = null;
            let testMethodNames: string[] = [];
            let range = element.Ranges[SymbolRangeNames.Name];

            for (let childElement of element.Children) {
                let [childTestFramework, childTestMethodName] =
                    TestFileInspector._getTestFrameworkAndMethodName(
                        childElement
                    );

                if (!testFramework && childTestFramework) {
                    testFramework = childTestFramework;
                    testMethodNames.push(childTestMethodName);
                } else if (
                    testFramework &&
                    childTestFramework === testFramework
                ) {
                    testMethodNames.push(childTestMethodName);
                }
            }

            const info: TestFile = {
                kind: "file",
                name: element.Name,
                fileName,
                range,
                testFramework,
                testMethodNames,
            };
            results.push(info);
        }

        return results;
    }
}

type TestDiscoveryInfo = TestInfo | TestFile;

interface TestInfo {
    range: V2.Range;
    testFramework: string;
    testMethodName: string;
    fileName: string;
    kind: "method";
}

interface TestFile {
    range: V2.Range;
    testFramework: string;
    testMethodNames: string[];
    fileName: string;
    name: string;
    kind: "file";
}

const mapTargetFramework = (targetFramework: TargetFramework) => {
    if (targetFramework.ShortName.startsWith("net4")) {
        return `.Framework,Version=v${targetFramework.ShortName.replace(
            "net4",
            "4."
        )}`;
    }
    if (targetFramework.ShortName.startsWith("net")) {
        return `.NETCoreApp,Version=v${targetFramework.ShortName.replace(
            "net",
            ""
        )}`;
    }
    if (targetFramework.ShortName.startsWith("netcoreapp")) {
        return `.NETCoreApp,Version=v${targetFramework.ShortName.replace(
            "netcoreapp",
            ""
        )}`;
    }
    if (targetFramework.ShortName.startsWith("netstandard")) {
        return `.NETStandard,Version=v${targetFramework.ShortName.replace(
            "netstandard",
            ""
        )}`;
    }
    switch (targetFramework.Name) {
        case ".NETCoreApp": {
        }
    }
};

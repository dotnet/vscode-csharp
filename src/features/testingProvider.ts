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
    V2,
} from "../omnisharp/protocol";
import { OmniSharpServer } from "../omnisharp/server";
import * as serverUtils from "../omnisharp/utils";
import TestManager from "./dotnetTest";

export default class TestingProvider extends AbstractProvider {
    private readonly _testAssemblies: Map<string, TestAssembly> = new Map<
        string,
        TestAssembly
    >();

    public controller: vscode.TestController;

    constructor(
        private readonly _optionProvider: OptionProvider,
        public readonly testManager: TestManager,
        server: OmniSharpServer,
        languageMiddlewareFeature: LanguageMiddlewareFeature
    ) {
        super(server, languageMiddlewareFeature);
        this.controller = vscode.tests.createTestController(
            "ms-dotnettools:csharp",
            ".Net Test Explorer"
        );
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
        const d6 = vscode.workspace.onDidOpenTextDocument(
            (e) => void this.reportFileChange(e.fileName)
        );
        const d7 = vscode.workspace.onDidChangeTextDocument(
            (e) => void this.reportFileChange(e.document.fileName)
        );
        this.addDisposables(
            new CompositeDisposable(this.controller, d1, d2, d3, d4, d5, d6, d7)
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

    public async reportFileChange(fileName: string): Promise<void> {
        if (!fileName.endsWith(".cs")) {
            return undefined;
        }
        let projectInfo: ProjectInformationResponse;
        try {
            projectInfo = await serverUtils.requestProjectInformation(
                this._server,
                { FileName: fileName }
            );
        } catch (error) {
            return undefined;
        }
        await this.reportProject(projectInfo.MsBuildProject);
    }

    public async removeProject(project: MSBuildProject): Promise<void> {
        this._testAssemblies.delete(project.AssemblyName);
        this._notify();
    }

    public async reportProject(project: MSBuildProject): Promise<void> {
        if ((project.SourceFiles?.length ?? 0) == 0) {
            return;
        }
        console.log("Project reported " + project.AssemblyName);

        const testInfo = await this.testManager.discoverTests(
            project.SourceFiles[0],
            "xunit",
            true
        );
        const name = project.AssemblyName;
        const discoveredTests = new Map<string, TestCase>();
        if (testInfo.length > 0) {
            testInfo.forEach((element) => {
                discoveredTests.set(
                    element.FullyQualifiedName,
                    this._createTestCase(name, element)
                );
            });
            this._testAssemblies.set(name, { name, discoveredTests });
            this._notify();
        }
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

    private _notify(): void {
        for (const element of this._testAssemblies.values()) {
            const assemblyTestCollection = this.controller.createTestItem(
                element.name,
                element.name
            );
            this._mapTreeToTestItems(
                assemblyTestCollection,
                this._buildTestTree(
                    Array.from(element.discoveredTests.values())
                )
            );
            this.controller.items.add(assemblyTestCollection);
        }
    }

    private _createTestCase(assembly: string, testInfo: V2.TestInfo): TestCase {
        return {
            ...testInfo,
            assembly,
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
                    `${child.assembly}/${child.FullyQualifiedName}`,
                    name,
                    vscode.Uri.parse("file://" + child.CodeFilePath)
                );
                childTestItem.range = new vscode.Range(
                    child.LineNumber,
                    0,
                    child.LineNumber,
                    0
                );
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
                workers.push(this._createBatchExecutor(testQueue, token));
            }

            await Promise.all(workers);
        } finally {
            listener.dispose();
        }
    }

    public async debugTests(token: vscode.CancellationToken): Promise<void> {
        const testItemsToExecute = this._extractTestItemsFromRequest();
        testItemsToExecute.forEach(this._testRun.enqueued);
        const executableTests = this._createExecutableTests(testItemsToExecute);
        const testQueue = TestQueue.create(executableTests);

        while (!testQueue.isEmpty() && !token.isCancellationRequested) {
            const batch = testQueue.dequeueBatch();
            await this._testAapter.testManager.debugDotnetTestsInClass(
                "",
                batch.tests.map((x) => x.testCase.FullyQualifiedName),
                batch.fileName,
                "xunit"
            );
        }
    }

    private async _createBatchExecutor(
        queue: TestQueue,
        token: vscode.CancellationToken
    ): Promise<void> {
        const batch = queue.dequeueBatch();

        if (!batch || token.isCancellationRequested) {
            return;
        }

        batch.tests.forEach(({ testItem }) => this._testRun.started(testItem));

        try {
            const results =
                await this._testAapter.testManager.runDotnetTestsInClass(
                    "",
                    batch.tests.map((x) => x.testCase.FullyQualifiedName),
                    batch.fileName,
                    "xunit"
                );

            results.forEach((result) => this._reportTestResult(result, queue));
        } catch (reason) {
            batch.tests.forEach(({ testItem }) =>
                this._testRun.failed(
                    testItem,
                    new vscode.TestMessage(reason.toString())
                )
            );
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
        return (
            items
                .map((testItem) => {
                    const [assembly, id] = testItem.id.split("/", 2);
                    const testCase = this._testAapter.resolveTestCase(
                        assembly,
                        id
                    );
                    return ExecutableTest.create(testCase, testItem);
                })
                .filter((x) => !!x.testCase) // ensure that the test case is resolved
                // TODO: investigate why this can be null
                .filter((x) => !!x.testCase.CodeFilePath)
        );
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
        return Object.entries(
            items.reduce<Record<string, ExecutableTest[]>>((pr, cur) => {
                if (!pr[cur.testCase.CodeFilePath]) {
                    pr[cur.testCase.CodeFilePath] = [];
                }
                pr[cur.testCase.CodeFilePath].push(cur);
                return pr;
            }, {})
        ).map(([fileName, tests]) => ({ fileName, tests }));
    }
}

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
    fileName: string;
    tests: ExecutableTest[];
}

interface TestAssembly {
    name: string;
    discoveredTests: Map<string, TestCase>;
}

interface TestCase extends V2.TestInfo {
    assembly: string;
    nameSegments: string[];
}

interface TestTreeNode {
    kind: "node";
    children: Record<string, TestCase | TestTreeNode>;
}

const isNode = (node: TestCase | TestTreeNode): node is TestTreeNode =>
    "kind" in node;

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import CompositeDisposable from "../CompositeDisposable";
import AbstractProvider from "./abstractProvider";
import * as path from "path";
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
    bufferTime,
    concatMap,
    debounceTime,
    distinct,
    filter,
    mergeMap,
    tap,
} from "rxjs/operators";
import Disposable from "../Disposable";
import { CancellationTokenSource } from "vscode-languageserver-protocol";
import { EventStream } from "../EventStream";
import {
    DotNetTestDiscoveryError,
    DotNetTestDiscoveryResult,
    DotNetTestDiscoveryStart,
} from "../omnisharp/loggingEvents";
import Structure = V2.Structure;
import SymbolKinds = V2.SymbolKinds;
import SymbolPropertyNames = V2.SymbolPropertyNames;
import SymbolRangeNames = V2.SymbolRangeNames;

/**
 * A test provder for the VSCode Testing API
 */
export default class TestingProvider extends AbstractProvider {
    private readonly _testAssemblies: Map<string, TestAssembly> = new Map<
        string,
        TestAssembly
    >();

    /**
     * The controller the provider uses to report the tests to vscode
     * @see {@link vscode.TestController}
     */
    public controller: vscode.TestController;

    private readonly _fileChangeDebouncer = new Subject<string>();
    private readonly _fileSaveDebouncer = new Subject<string>();
    private readonly _projectChangedDebouncer =
        new Subject<ProjectBuildDiscoveryRequest>();

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
                filter((x) => x.endsWith(".cs")), // only c# files are of interest
                distinct(null, flushFiles), // we wait until the channel is 1.5s silent
                buffer(flushFiles), // buffer the flushed files
                filter((x) => x.length > 0), // omit empty file lists
                mergeMap(async (files) => this._reportFileChanges(files)) // notify about file changes
            )
            .subscribe(
                () => {},
                (e) =>
                    this._reportDiscoveryError(
                        `Fatal error in test discovery! Test change listener stopped!`,
                        e
                    ),
                () =>
                    this._reportDiscoveryError(
                        "Testfile change listener stopped"
                    )
            );

        const flushSaved = this._fileSaveDebouncer.pipe(debounceTime(1500));
        const s2 = this._fileSaveDebouncer
            .pipe(
                filter((x) => x.endsWith(".cs") || x.endsWith(".csproj")), // only c# files are of interest
                distinct(null, flushSaved), // we wait until the channel is 1.5s silent (save many)
                buffer(flushSaved), // buffer the flushed files
                filter((x) => x.length > 0), // ignore empty list of files
                mergeMap(async (files) => this._reportFileSaves(files)) // notify about file saves
            )
            .subscribe(
                () => {},
                (e) =>
                    this._reportDiscoveryError(
                        `Fatal error in test discovery! Test save listener stopped!`,
                        e
                    ),
                () =>
                    this._reportDiscoveryError("Testfile save listener stopped")
            );

        const s3 = this._projectChangedDebouncer
            .pipe(
                // TODO this is obviously a bad idea
                filter((x) => x.project.AssemblyName.endsWith("Tests")),
                tap((v) =>
                    this._mapFolderTreeToTestController(v.project.Path, true)
                ),
                bufferTime(
                    // wait for projects to be reported, batch N
                    500,
                    undefined,
                    this._optionProvider.GetLatestOptions()
                        .testMaxLoadedProjectPerRequest
                ),
                concatMap(
                    async (projects) =>
                        await Promise.all(
                            projects.map(({ project, noBuild }) =>
                                this._reportProject(project, noBuild)
                            )
                        )
                )
            )
            .subscribe(
                () => {},
                (e) =>
                    this._reportDiscoveryError(
                        `Fatal error in test discovery! Project disovery stopped!`,
                        e
                    ),
                () => this._reportDiscoveryError("Project disovery stopped")
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
            (p) => void this.reportProject(p.MsBuildProject, false)
        );
        const d4 = server.onProjectAdded(
            (p) => void this.reportProject(p.MsBuildProject, false)
        );
        const d5 = server.onProjectRemoved(
            (p) => void this.reportRemovedProject(p.MsBuildProject)
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

    /**
     * Resolves a {@link TestCase} based of on {@link vscode.TestItem.id}
     * @param id The {@link vscode.TestItem.id}
     * @returns A test case or undefined if the test case is not found
     */
    public resolveTestCaseById(id: string): TestCase | undefined {
        const [assembly] = id.split("/", 3);
        return this._testAssemblies.get(assembly)?.discoveredTests.get(id);
    }

    /**
     * Informs the provider about a file change
     * @param fileName The name of the file
     */
    public reportFileChange(fileName: string) {
        this._fileChangeDebouncer.next(fileName);
    }

    /**
     * Informs the provider about a saved file
     * @param fileName The name of the file
     */
    public reportFileSave(fileName: string) {
        this._fileSaveDebouncer.next(fileName);
    }

    /**
     * Informs the provider about a deleted files
     * @param fileNames The name of the files
     */
    public reportFileDeletes(fileNames: string[]) {
        const uniqueFileNames = new Set(
            fileNames.filter((x) => x.endsWith(".cs"))
        );
        if (uniqueFileNames.size == 0) {
            return;
        }

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

    /**
     * Informs the provider about a removed project
     * @param fileNames The name of the removed project
     */
    public async reportRemovedProject(project: MSBuildProject): Promise<void> {
        this._testAssemblies.delete(project.AssemblyName);
        const folder = this._mapFolderTreeToTestController(project.Path);
        folder.children.delete(project.AssemblyName);
    }

    /**
     * Informs the provider about a new project
     * @param fileNames The name of the new project
     */
    public reportProject(project: MSBuildProject, noBuild: boolean) {
        this._projectChangedDebouncer.next({ project, noBuild });
    }

    private _reportDiscoveryError(message: string, error: any = null) {
        if (error instanceof Error) {
            message += `Exception: ${error.name}`;
            message += `\n${error.message}`;
            message += `\n${error.stack}`;
        }
        this._eventStream.post(new DotNetTestDiscoveryError(message));
    }

    /**
     * Processes many file changes. Tries to update the {@link TestCase.discoveryInfo.range } to
     * position the execute buttons correctly. This will not force a reload of the project
     * @param fileNames The names of the changed files
     */
    private async _reportFileChanges(fileNames: string[]): Promise<void> {
        const inspector = await TestFileInspector.load(this._server, fileNames);
        const testFiles = inspector.getAllTests();

        for (const fileName of new Set(fileNames)) {
            let projectInfo: ProjectInformationResponse;
            try {
                // request the project information so that we know the assembly name
                projectInfo = await serverUtils.requestProjectInformation(
                    this._server,
                    { FileName: fileName }
                );
            } catch (error) {
                return;
            }

            this._tryUpdateTestInformationInline(
                projectInfo.MsBuildProject,
                fileName,
                testFiles
            );
        }
    }

    /**
     * Processes many file saved. Tries to do a inline update first. If the structure of the document
     * has changed to much, the project will be reloaded from Omnisharp
     * @param fileNames the names of the saved files
     * @returns
     */
    private async _reportFileSaves(fileNames: string[]): Promise<void> {
        const inspector = await TestFileInspector.load(this._server, fileNames);
        const testsFromCodeStructure = inspector.getAllTests();

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

            if (
                !this._tryUpdateTestInformationInline(
                    projectInfo.MsBuildProject,
                    fileName,
                    testsFromCodeStructure
                )
            ) {
                // if the tests could not be updated inline, we reload the project
                this.reportProject(projectInfo.MsBuildProject, false);
            }
        }
    }

    /**
     * Tries to update the tests without reloading the project. It reads the exisiting tests cases
     * and compares them to the code structure of the changed file.
     * @param project The project
     * @param fileName The file name of the changed file
     * @param testsFromCodeStructure The
     * @returns
     */
    private _tryUpdateTestInformationInline(
        project: MSBuildProject,
        fileName: string,
        testsFromCodeStructure: TestDiscoveryInfo[]
    ): boolean {
        if (!fileName.endsWith(".cs")) {
            return false;
        }

        const assembly = this._testAssemblies.get(project.AssemblyName);
        // in case we do not know the assembly, we do not know that it exists
        if (!assembly) {
            return false;
        }

        // we only validate the tests for a single target framework. This means inline updates
        // would not work with framework specific tests
        const groupedTestsFromController = groupBy(
            [...assembly.discoveredTests.values()],
            (x) => x.targetFramework
        );
        if (groupedTestsFromController.length != 1) {
            return false;
        }

        const testsInController = groupedTestsFromController[0]
            .filter((x) => x.CodeFilePath == fileName)
            .sort((x, y) =>
                x.FullyQualifiedName.localeCompare(y.FullyQualifiedName)
            );
        const testFromInspector = testsFromCodeStructure
            .filter((x) => x.fileName == fileName)
            .sort((x, y) => x.testMethodName.localeCompare(y.testMethodName));

        // in case the two lists are not equally long, there are new tests or a tests was deleted
        if (testsInController.length != testFromInspector.length) {
            return false;
        }

        for (let i = 0; i < testFromInspector.length; i++) {
            // check if a tests was renamed or replaced
            if (
                testsInController[i].FullyQualifiedName !=
                testFromInspector[i].testMethodName
            ) {
                return false;
            }
            testsInController[i].discoveryInfo = testFromInspector[i];
        }

        // upsert the assembly on the controller
        this._upsertAssemblyOnController(assembly);
        return true;
    }

    /**
     * Discovers the tests in a assembly. Uses a file name to identifiy the relevant assembly.
     * Tries first to build the project to get the newest tests, if this fails, tries to get the
     * test info without building
     * @param fileName  arbitrary file in the assembly
     * @param testFramework the test framework that should be used
     * @param targetFramework the targetframework that should be used
     * @returns a list of disovered tests
     */
    private async _discoverTests(
        fileName: string,
        testFramework: string,
        targetFramework: string,
        noBuild: boolean
    ) {
        let testInfo: V2.TestInfo[] = [];
        try {
            try {
                testInfo = await this.testManager.discoverTests(
                    fileName,
                    testFramework,
                    noBuild,
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
        } catch {}

        return testInfo;
    }

    /**
     * Loads the tests in a project and adds the tests to the test controller
     * @param project The project to load the tests from
     * @returns
     */
    private async _reportProject(
        project: MSBuildProject,
        noBuild: boolean
    ): Promise<void> {
        const sourceFile = project.SourceFiles?.[0];
        if (!sourceFile) {
            return;
        }

        this._eventStream.post(
            new DotNetTestDiscoveryStart(project.AssemblyName, noBuild)
        );

        let testInfo: (V2.TestInfo & { targetFramework: string })[] = [];

        const start = Date.now();

        // loads the target test infor from omnisharp concurrently
        await Promise.all(
            project.TargetFrameworks.map(async (targetFramework) => {
                testInfo.push(
                    ...(
                        await this._discoverTests(
                            sourceFile,
                            "", // the test framework is actually ingored by omnisharp
                            mapTargetFramework(targetFramework.ShortName),
                            noBuild
                        )
                    ).map((x) => ({
                        ...x,
                        targetFramework: targetFramework.ShortName,
                    }))
                );
            })
        );

        const assemblyName = project.AssemblyName;
        const discoveredTests = new Map<string, TestCase>();
        const inspector = await TestFileInspector.load(
            this._server,
            testInfo.map((x) => x.CodeFilePath).filter((x) => !!x)
        );
        if (testInfo.length > 0) {
            testInfo.forEach((element) => {
                const testCase = this._createTestCase(
                    assemblyName,
                    element,
                    inspector,
                    element.targetFramework
                );
                discoveredTests.set(testCase.id, testCase);
            });
            const assembly: TestAssembly = {
                name: assemblyName,
                path: project.Path,
                discoveredTests,
                targetFrameworks: project.TargetFrameworks,
            };
            this._testAssemblies.set(assemblyName, assembly);
            this._upsertAssemblyOnController(assembly);
        } else {
            const folder = this._mapFolderTreeToTestController(project.Path);
            folder.parent!.children.delete(folder.id);
        }
        this._eventStream.post(
            new DotNetTestDiscoveryResult(
                assemblyName,
                discoveredTests.size,
                Date.now() - start,
                noBuild
            )
        );
    }

    /**
     * Processes a request from the testController to run tests
     * @param request The request
     * @param token The cancellation token
     */
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

    /**
     * Processes a request from the testController to debug tests
     * @param request The request
     * @param token The cancellation token
     */
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

    /**
     * Gets or creates the root of the test explorer tree for a workspace
     * @param projectPath The path of a project in the workspace
     */
    private _getOrCreateWorkspaceRoot(
        projectPath: string,
        busy: boolean
    ): vscode.TestItem {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(
            vscode.Uri.file(projectPath)
        );

        let folder: vscode.TestItem;
        if (workspaceFolder == undefined) {
            let externalProject = this.controller.items.get(
                "external-project-root"
            );
            if (!externalProject) {
                externalProject = this.controller.createTestItem(
                    "external-project-root",
                    "[External]"
                );
                this.controller.items.add(externalProject);
            }
            folder = externalProject;
        } else {
            folder = this.controller.items.get(workspaceFolder.uri.path);
            if (!folder) {
                folder = this.controller.createTestItem(
                    workspaceFolder.uri.path,
                    workspaceFolder.name,
                    vscode.Uri.file(workspaceFolder.uri.path)
                );
                this.controller.items.add(folder);
            }
        }

        folder.busy = busy;
        return folder;
    }

    /**
     * Maps the path of a project as a tree of folders into the test controller.
     * @param assembly
     * @returns the folder the assemlbly is in
     */
    private _mapFolderTreeToTestController(
        projectPath: string,
        busy: boolean = false
    ): vscode.TestItem {
        let root: vscode.TestItem = this._getOrCreateWorkspaceRoot(
            projectPath,
            busy
        );

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(
            vscode.Uri.file(projectPath)
        )?.uri?.path;

        let segments: string[] = [];
        if (workspaceFolder) {
            const relativePathOfAssemblyToWorkspace = path.relative(
                workspaceFolder,
                projectPath
            );

            segments = path
                .dirname(relativePathOfAssemblyToWorkspace)
                .split(path.sep)
                .filter((x) => x.length > 0);
        }

        let currentTestItem = root;
        let currentPath: string = workspaceFolder; // last slash will be add
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            currentPath = `${currentPath}/${segment}`;
            let child = currentTestItem.children.get(currentPath);
            if (!child) {
                child = this.controller.createTestItem(
                    currentPath,
                    segment,
                    vscode.Uri.file(currentPath)
                );

                currentTestItem.children.add(child);
            }
            currentTestItem = child;
            currentTestItem.busy = busy;
        }

        return currentTestItem;
    }

    /**
     * Adds or replaces the test item in the controller based on a assembly.
     * @param assembly
     */
    private _upsertAssemblyOnController(assembly: TestAssembly): void {
        let folder = this._mapFolderTreeToTestController(assembly.path);

        const assemblyFolder = this.controller.createTestItem(
            path.dirname(assembly.path),
            assembly.name,
            vscode.Uri.file(assembly.path)
        );

        if (folder.id == path.dirname(assembly.path)) {
            folder.parent.children.add(assemblyFolder);
        } else {
            folder.children.add(assemblyFolder);
        }

        assembly.targetFrameworks.map((targetFramework) => {
            let parent: vscode.TestItem;

            // only add a node to the tree when there are more than one target frameworks, else
            // just display all the tests cases directly under the root
            if (assembly.targetFrameworks.length == 1) {
                parent = assemblyFolder;
            } else {
                parent =
                    assemblyFolder.children.get(targetFramework.ShortName) ??
                    this.controller.createTestItem(
                        targetFramework.ShortName,
                        targetFramework.ShortName
                    );
                assemblyFolder.children.add(parent);
            }

            // clear old children
            parent.children.replace([]);

            const tree = this._buildTestTree(
                Array.from(assembly.discoveredTests.values()).filter(
                    (x) => x.targetFramework == targetFramework.ShortName
                )
            );
            this._mapTreeToTestItems(parent, tree);
        });
    }

    /**
     * creates a tests case based on the provided information
     */
    private _createTestCase(
        assembly: string,
        testInfo: V2.TestInfo,
        inspector: TestFileInspector,
        targetFramework: string
    ): TestCase {
        const discoveryInfo = inspector.getTestInfo(
            testInfo.FullyQualifiedName
        );
        const fileInfo = inspector.getFileInfo(testInfo.CodeFilePath);

        // we remove the assembly name from the fqn
        let fullyQualifiedName = testInfo.FullyQualifiedName;
        if (fullyQualifiedName.startsWith(`${assembly}.`)) {
            fullyQualifiedName = testInfo.FullyQualifiedName.substring(
                assembly.length + 1
            );
        }
        const nameSegments = this._parseName(fullyQualifiedName);

        return {
            id: `${assembly}/${testInfo.FullyQualifiedName}/${targetFramework}`,
            ...testInfo,
            assembly,
            discoveryInfo,
            fileInfo,
            targetFramework,
            testFramework: discoveryInfo?.testFramework ?? "xunit",
            nameSegments,
        };
    }

    /**
     * Parses a name of a test into segments.
     * @example Foo.Bar.Baz => [Foo, Bar, Baz]
     * @example Foo.Bar.Baz(qux: "Quux") => [Foo, Bar, Baz]
     * @param name the name to parse
     * @returns the segement sof the parsed name
     */
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

    /**
     * Transforms a flat list of test cases into a tree
     * @param testCases The test cases
     * @returns The tree
     */
    private _buildTestTree(testCases: TestCase[]): TestTreeNode {
        const root: TestTreeElement = { kind: "namespace", children: {} };
        for (const testCase of testCases) {
            let currentNode: TestTreeElement = root;
            for (let i = 0; i < testCase.nameSegments.length; i++) {
                if (isClass(currentNode)) {
                    // element is leaf
                    currentNode.children[testCase.nameSegments[i]] = testCase;
                } else if (isNamespace(currentNode)) {
                    // element is node
                    const child: TestNamespace | TestClass | undefined =
                        currentNode.children[testCase.nameSegments[i]];

                    // check if the path already exists
                    if (child == undefined) {
                        // create a new node
                        let newNode: TestTreeNode;
                        if (i == testCase.nameSegments.length - 2) {
                            // must be a class
                            newNode = {
                                kind: "class",
                                children: {},
                                fileInfo: testCase.fileInfo,
                            };
                        } else {
                            // must be a namepsace
                            newNode = {
                                kind: "namespace",
                                children: {},
                            };
                        }
                        currentNode.children[testCase.nameSegments[i]] =
                            newNode;
                        currentNode = newNode;
                    } else if (isNode(child)) {
                        // visit the already existing node
                        currentNode = child;
                    }
                }
            }
        }

        return root;
    }

    /**
     * maps a tree of test items into a hirachy of test items. This methods also flattens the tree
     * when there single items
     * @example
     * FROM:
     *          a
     *        |   \
     *       b     c
     *    |   \      \
     *   d     e      f
     * TO:
     *          a
     *        |   \
     *       b     c.f
     *     |   \
     *   d     e
     */
    private _mapTreeToTestItems(
        testItem: vscode.TestItem,
        tree: TestTreeNode,
        prefix: string = undefined
    ): vscode.TestItem {
        const keys = Object.keys(tree.children);

        // flattens the path
        if (keys.length == 1) {
            const child = tree.children[keys[0]];
            if (isNode(child) && !isClass(child)) {
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
                let childTestItem: vscode.TestItem;
                if (isClass(child) && !!child.fileInfo) {
                    childTestItem = this.controller.createTestItem(
                        name,
                        name,
                        vscode.Uri.file(child.fileInfo.fileName)
                    );

                    childTestItem.range = new vscode.Range(
                        child.fileInfo.range.Start.Line,
                        child.fileInfo.range.Start.Column,
                        child.fileInfo.range.End.Line,
                        child.fileInfo.range.End.Column
                    );
                } else {
                    childTestItem = this.controller.createTestItem(name, name);
                }
                testItem.children.add(childTestItem);
                this._mapTreeToTestItems(childTestItem, child);
            } else {
                const childTestItem = this.controller.createTestItem(
                    child.id,
                    name,
                    child.CodeFilePath
                        ? vscode.Uri.file(child.CodeFilePath)
                        : undefined
                );

                // add the range from the discovery info when available because it is more accurate
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
        const listener = this._server.onTestMessage((e) => {
            this._testRun.appendOutput(`${e.Message}\n\r`);
        });
        try {
            for (const byTargetFramework of groupBy(
                executableTests,
                (x) => x.testCase.targetFramework
            )) {
                const testQueue = TestQueue.create(byTargetFramework);

                const workers: Promise<void>[] = [];

                for (let i = 0; i < maxDegreeOfParallelism; i++) {
                    workers.push(
                        this._createBatchExecutor(
                            testQueue,
                            combinationTokenSource.token
                        )
                    );
                }

                await Promise.all(workers);
            }
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
                    batch.testFramework,
                    false,
                    batch.targetFramework
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
                        batch.testFramework,
                        false,
                        batch.targetFramework
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
        let included: vscode.TestItem[] = [];
        if (this._request.include == null) {
            this._testAapter.controller.items.forEach((x) => included.push(x));
        } else {
            included = this._request.include;
        }
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
                const testCase = this._testAapter.resolveTestCaseById(
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

/**
 * A queue of test batches cases
 */
class TestQueue {
    private readonly _testsLookup = new Map<string, ExecutableTest>();

    private constructor(private readonly _batches: TestBatch[]) {
        _batches.forEach((b) =>
            b.tests.forEach((t) =>
                this._testsLookup.set(t.testCase.FullyQualifiedName, t)
            )
        );
    }

    /**
     * @returns true if the queue is empty
     */
    public isEmpty() {
        return this._batches.length == 0;
    }

    /**
     * Dequeues and returns the next batch from the queue
     */
    public dequeueBatch(): TestBatch | undefined {
        return this._batches.splice(0, 1)[0];
    }

    /**
     * resolves a test item by the name of the method
     */
    public getTestItemByMethodName(
        methodName: string
    ): vscode.TestItem | undefined {
        return this._testsLookup.get(methodName)?.testItem;
    }

    /**
     * creates a new instance of a test queue
     */
    public static create(tests: ExecutableTest[]): TestQueue {
        const batches = this._createBatches(tests);
        return new TestQueue(batches);
    }

    /**
     * Groups {@link ExecutableTest} by the testFramework, targetFramework, and assembly
     * @returns a record with the assembly name as key and a list of tests as the value
     */
    private static _createBatches(items: ExecutableTest[]): TestBatch[] {
        const batches: TestBatch[] = [];
        groupBy(items, (x) => x.testCase.testFramework)
            .map((x) =>
                groupBy(x, (y) => y.testCase.testFramework).map((x) =>
                    groupBy(x, (y) => y.testCase.assembly)
                )
            )
            .forEach((byTestFramework) => {
                byTestFramework
                    .filter((x) => x.length > 0)
                    .forEach((byTargetFramwork) => {
                        byTargetFramwork
                            .filter((x) => x.length > 0)
                            .forEach((byAssembly) =>
                                batches.push({
                                    targetFramework: mapTargetFramework(
                                        byAssembly[0].testCase.targetFramework
                                    ),
                                    testFramework:
                                        byAssembly[0].testCase.testFramework,
                                    assemblyName:
                                        byAssembly[0].testCase.assembly,
                                    tests: byAssembly,
                                })
                            );
                    });
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
    targetFramework: string;
    tests: ExecutableTest[];
}

interface TestAssembly {
    name: string;
    path: string;
    discoveredTests: Map<string, TestCase>;
    targetFrameworks: TargetFramework[];
}

interface TestCase extends V2.TestInfo {
    id: string;
    assembly: string;
    nameSegments: string[];
    discoveryInfo?: TestDiscoveryInfo;
    fileInfo?: TestFileDiscoveryInfo;
    testFramework: string;
    targetFramework: string;
}

type TestTreeElement = TestCase | TestTreeNode;
type TestTreeNode = TestNamespace | TestClass;

interface TestNamespace {
    kind: "namespace";
    children: Record<string, TestClass | TestNamespace>;
}

interface TestClass {
    kind: "class";
    fileInfo?: TestFileDiscoveryInfo;
    children: Record<string, TestCase>;
}

const isNode = (node: TestTreeElement): node is TestTreeNode => "kind" in node;

const isClass = (node: TestTreeNode): node is TestClass => node.kind == "class";

const isNamespace = (node: TestTreeNode): node is TestNamespace =>
    node.kind == "namespace";

/**
 * Inspects the code structure of files to get additional information about the files
 */
class TestFileInspector {
    constructor(
        private readonly _loadedFiles: Map<string, TestFileDiscoveryInfo>,
        private readonly _loadedTests: Map<string, TestDiscoveryInfo>
    ) {}

    /**
     * gets all disvoered tests
     */
    public getAllTests() {
        return [...this._loadedTests.values()];
    }

    /**
     * Gets the testinfo by the method name
     */
    public getTestInfo(methodName: string) {
        return this._loadedTests.get(methodName);
    }

    /**
     * Gets the testinfo by the file name
     */
    public getFileInfo(name: string) {
        return this._loadedFiles.get(name);
    }

    /**
     * Loads the structure of the files, inspects it and creates and instance of the inspector
     */
    public static async load(
        server: OmniSharpServer,
        fileNames: string[]
    ): Promise<TestFileInspector> {
        const token = new CancellationTokenSource().token;
        const loadedFiles = new Map<string, TestFileDiscoveryInfo>();
        const loadedTests = new Map<string, TestDiscoveryInfo>();
        const unqueFileNames = [...new Set(fileNames)];

        // request the code structure concurrently from omnisharp
        await Promise.all(
            unqueFileNames.map(async (file) => {
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
                            loadedFiles.set(file, info);
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
    ): DiscoveryInfo[] {
        const results: DiscoveryInfo[] = [];

        if (TestFileInspector._isValidMethodForTestCodeLens(element)) {
            let [testFramework, testMethodName] =
                TestFileInspector._getTestFrameworkAndMethodName(element);
            let range = element.Ranges[SymbolRangeNames.Name];

            if (range && testFramework && testMethodName) {
                const info: TestDiscoveryInfo = {
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

            const info: TestFileDiscoveryInfo = {
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

type DiscoveryInfo = TestDiscoveryInfo | TestFileDiscoveryInfo;

interface TestDiscoveryInfo {
    range: V2.Range;
    testFramework: string;
    testMethodName: string;
    fileName: string;
    kind: "method";
}

interface TestFileDiscoveryInfo {
    range: V2.Range;
    testFramework: string;
    testMethodNames: string[];
    fileName: string;
    name: string;
    kind: "file";
}

const mapTargetFramework = (targetFrameworkShortName: string) => {
    if (targetFrameworkShortName.startsWith("net4")) {
        return `.Framework,Version=v${targetFrameworkShortName.replace(
            "net4",
            "4."
        )}`;
    }
    if (targetFrameworkShortName.startsWith("netcoreapp")) {
        return `.NETCoreApp,Version=v${targetFrameworkShortName.replace(
            "netcoreapp",
            ""
        )}`;
    }
    if (targetFrameworkShortName.startsWith("netstandard")) {
        return `.NETStandard,Version=v${targetFrameworkShortName.replace(
            "netstandard",
            ""
        )}`;
    }
    if (targetFrameworkShortName.startsWith("net")) {
        return `.NETCoreApp,Version=v${targetFrameworkShortName.replace(
            "net",
            ""
        )}`;
    }
};

interface ProjectBuildDiscoveryRequest {
    project: MSBuildProject;
    noBuild: boolean;
}

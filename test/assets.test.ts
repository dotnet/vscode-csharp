/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import * as path from 'path';
import * as protocol from '../src/omnisharp/protocol';
import { AssetGenerator } from '../src/assets';
import { parse } from 'jsonc-parser';

suite("Asset generation: project.json", () => {
    suiteSetup(() => should());

    test("Create tasks.json for project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createDotNetWorkspaceInformation(rootPath, 'testApp.dll', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let tasksJson = generator.createTasksConfiguration();
        let buildPath = tasksJson.tasks[0].args[1];

        // ${workspaceFolder}/project.json
        let segments = buildPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'project.json']);
    });

    test("Create tasks.json for nested project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createDotNetWorkspaceInformation(path.join(rootPath, 'nested'), 'testApp.dll', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let tasksJson = generator.createTasksConfiguration();
        let buildPath = tasksJson.tasks[0].args[1];

        // ${workspaceFolder}/nested/project.json
        let segments = buildPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'nested', 'project.json']);
    });

    test("Create launch.json for project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createDotNetWorkspaceInformation(rootPath, 'testApp.dll', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let launchJson = parse(generator.createLaunchJson(/*isWebProject*/ false), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for nested project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createDotNetWorkspaceInformation(path.join(rootPath, 'nested'), 'testApp.dll', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let launchJson = parse(generator.createLaunchJson(/*isWebProject*/ false), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/nested/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'nested', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for web project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createDotNetWorkspaceInformation(rootPath, 'testApp.dll', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let launchJson = parse(generator.createLaunchJson(/*isWebProject*/ true), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for nested web project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createDotNetWorkspaceInformation(path.join(rootPath, 'nested'), 'testApp.dll', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let launchJson = parse(generator.createLaunchJson(/*isWebProject*/ true), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/nested/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'nested', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });
});

function createDotNetWorkspaceInformation(projectPath: string, compilationOutputAssemblyFile: string, targetFrameworkShortName: string, emitEntryPoint: boolean = true): protocol.WorkspaceInformationResponse {
    return {
        DotNet: {
            Projects: [
                {
                    Path: projectPath,
                    Name: '',
                    ProjectSearchPaths: [],
                    Configurations: [
                        {
                            Name: 'Debug',
                            CompilationOutputPath: '',
                            CompilationOutputAssemblyFile: compilationOutputAssemblyFile,
                            CompilationOutputPdbFile: '',
                            EmitEntryPoint: emitEntryPoint
                        }
                    ],
                    Frameworks: [
                        {
                            Name: '',
                            FriendlyName: '',
                            ShortName: targetFrameworkShortName
                        }
                    ],
                    SourceFiles: []
                }
            ],
            RuntimePath: ''
        }
    };
}

suite("Asset generation: csproj", () => {
    suiteSetup(() => should());

    test("Create tasks.json for project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'testApp.csproj'), 'testApp', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let tasksJson = generator.createTasksConfiguration();
        let buildPath = tasksJson.tasks[0].args[1];

        // ${workspaceFolder}/project.json
        let segments = buildPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'testApp.csproj']);
    });

    test("Create tasks.json for nested project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'nested', 'testApp.csproj'), 'testApp', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let tasksJson = generator.createTasksConfiguration();
        let buildPath = tasksJson.tasks[0].args[1];

        // ${workspaceFolder}/nested/project.json
        let segments = buildPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'nested', 'testApp.csproj']);
    });

    test("Create launch.json for project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'testApp.csproj'), 'testApp', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let launchJson = parse(generator.createLaunchJson(/*isWebProject*/ false), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for nested project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'nested', 'testApp.csproj'), 'testApp', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let launchJson = parse(generator.createLaunchJson(/*isWebProject*/ false), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/nested/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'nested', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for web project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'testApp.csproj'), 'testApp', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let launchJson = parse(generator.createLaunchJson(/*isWebProject*/ true), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for nested web project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'nested', 'testApp.csproj'), 'testApp', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let launchJson = parse(generator.createLaunchJson(/*isWebProject*/ true), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/nested/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'nested', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });
});

function createMSBuildWorkspaceInformation(projectPath: string, assemblyName: string, targetFrameworkShortName: string, isExe: boolean = true): protocol.WorkspaceInformationResponse {
    return {
        MsBuild: {
            SolutionPath: '',
            Projects: [
                {
                    ProjectGuid: '',
                    Path: projectPath,
                    AssemblyName: assemblyName,
                    TargetPath: '',
                    TargetFramework: '',
                    SourceFiles: [],
                    TargetFrameworks: [
                        {
                            Name: '',
                            FriendlyName: '',
                            ShortName: targetFrameworkShortName
                        }
                    ],
                    OutputPath: '',
                    IsExe: isExe,
                    IsUnityProject: false
                }
            ],
        }
    };
}

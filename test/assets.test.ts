/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import * as path from 'path';
import * as protocol from '../src/omnisharp/protocol';
import { AssetGenerator } from '../src/assets';

suite("Asset generation", () => {
    suiteSetup(() => should());

    test("Create tasks.json for project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createDotNetWorkspaceInformation(rootPath, 'testApp.dll', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let tasksJson = generator.createTasksConfiguration();
        let buildPath = tasksJson.tasks[0].args[0];

        // ${workspaceRoot}/project.json
        let segments = buildPath.split(path.sep);
        segments.should.deep.equal(['${workspaceRoot}', 'project.json']);
    });

    test("Create tasks.json for nested project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createDotNetWorkspaceInformation(path.join(rootPath, 'nested'), 'testApp.dll', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let tasksJson = generator.createTasksConfiguration();
        let buildPath = tasksJson.tasks[0].args[0];

        // ${workspaceRoot}/nested/project.json
        let segments = buildPath.split(path.sep);
        segments.should.deep.equal(['${workspaceRoot}', 'nested', 'project.json']);
    });

    test("Create launch.json for project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createDotNetWorkspaceInformation(rootPath, 'testApp.dll', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let launchJson = generator.createLaunchJson(/*isWebProject*/ false);
        let programPath = launchJson.configurations[0].program;

        // ${workspaceRoot}/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.sep);
        segments.should.deep.equal(['${workspaceRoot}', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for nested project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createDotNetWorkspaceInformation(path.join(rootPath, 'nested'), 'testApp.dll', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let launchJson = generator.createLaunchJson(/*isWebProject*/ false);
        let programPath = launchJson.configurations[0].program;

        // ${workspaceRoot}/nested/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.sep);
        segments.should.deep.equal(['${workspaceRoot}', 'nested', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for web project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createDotNetWorkspaceInformation(rootPath, 'testApp.dll', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let launchJson = generator.createLaunchJson(/*isWebProject*/ true);
        let programPath = launchJson.configurations[0].program;

        // ${workspaceRoot}/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.sep);
        segments.should.deep.equal(['${workspaceRoot}', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for nested web project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createDotNetWorkspaceInformation(path.join(rootPath, 'nested'), 'testApp.dll', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, rootPath);
        let launchJson = generator.createLaunchJson(/*isWebProject*/ true);
        let programPath = launchJson.configurations[0].program;

        // ${workspaceRoot}/nested/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.sep);
        segments.should.deep.equal(['${workspaceRoot}', 'nested', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });
});

function createDotNetWorkspaceInformation(projectPath: string, compilationOutputAssemblyFile: string, targetFrameworkShortName: string, emitEntryPoint: boolean = true) : protocol.WorkspaceInformationResponse {
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

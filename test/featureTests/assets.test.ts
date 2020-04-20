/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as protocol from '../../src/omnisharp/protocol';
import * as vscode from 'vscode';

import { AssetGenerator, ProgramLaunchType } from '../../src/assets';
import { parse } from 'jsonc-parser';
import { should } from 'chai';

suite("Asset generation: csproj", () => {
    suiteSetup(() => should());

    test("Create tasks.json for project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'testApp.csproj'), 'testApp', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        let tasksJson = generator.createTasksConfiguration();
        let buildPath = tasksJson.tasks[0].args[1];

        // ${workspaceFolder}/project.json
        let segments = buildPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'testApp.csproj']);
    });

    test("Generated tasks.json has the property GenerateFullPaths set to true ", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'testApp.csproj'), 'testApp', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        let tasksJson = generator.createTasksConfiguration();

        tasksJson.tasks.forEach(task => task.args.should.contain("/property:GenerateFullPaths=true"));
    });

    test("Generated tasks.json has the consoleloggerparameters argument set to NoSummary", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'testApp.csproj'), 'testApp', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        let tasksJson = generator.createTasksConfiguration();

        tasksJson.tasks.forEach(task => task.args.should.contain("/consoleloggerparameters:NoSummary"));
    });

    test("Create tasks.json for nested project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'nested', 'testApp.csproj'), 'testApp', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        let tasksJson = generator.createTasksConfiguration();
        let buildPath = tasksJson.tasks[0].args[1];

        // ${workspaceFolder}/nested/project.json
        let segments = buildPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'nested', 'testApp.csproj']);
    });

    test("Create launch.json for project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'testApp.csproj'), 'testApp', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        let launchJson = parse(generator.createLaunchJsonConfigurations(ProgramLaunchType.Console), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for NET 5 project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'testApp.csproj'), 'testApp', 'net5.0', /*isExe*/ true);
        let generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        let launchJson = parse(generator.createLaunchJsonConfigurations(ProgramLaunchType.Console), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/bin/Debug/net5.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'bin', 'Debug', 'net5.0', 'testApp.dll']);
    });

    test("Create launch.json for nested project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'nested', 'testApp.csproj'), 'testApp', 'netcoreapp1.0');
        let generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        let launchJson = parse(generator.createLaunchJsonConfigurations(ProgramLaunchType.Console), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/nested/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'nested', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for Blazor web assembly standalone project opened in workspace", () => {
        const rootPath = path.resolve('testRoot');
        const info = createMSBuildWorkspaceInformation(path.join(rootPath, 'testApp.csproj'), 'testApp', 'netstandard2.1', /*isExe*/ true, /*isWebProject*/ true, /*isBlazorWebAssemblyStandalone*/ true);
        const generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        const launchJson = parse(generator.createLaunchJsonConfigurations(ProgramLaunchType.BlazorWebAssemblyStandalone), undefined, { disallowComments: true });
        const devServerLaunchConfig = launchJson[0];
        const chromeLaunchConfig = launchJson[1];
        const devProgram = devServerLaunchConfig.program;
        const chromeWebRoot = chromeLaunchConfig.webRoot;

        devProgram.should.equal('dotnet');
        chromeWebRoot.should.equal('${workspaceFolder}');
    });

    test("Create launch.json for nested Blazor web assembly standalone project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'nested', 'testApp.csproj'), 'testApp', 'netstandard2.1', /*isExe*/ true, /*isWebProject*/ true, /*isBlazorWebAssemblyStandalone*/ true);
        let generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        let launchJson = parse(generator.createLaunchJsonConfigurations(ProgramLaunchType.BlazorWebAssemblyStandalone), undefined, { disallowComments: true });
        const devServerLaunchConfig = launchJson[0];
        const chromeLaunchConfig = launchJson[1];
        const devProgram = devServerLaunchConfig.program;
        const chromeWebRoot = chromeLaunchConfig.webRoot;

        devProgram.should.equal('dotnet');
        chromeWebRoot.should.equal('${workspaceFolder}/nested');
    });

    test("Create launch.json for Blazor web assembly hosted project opened in workspace", () => {
        const rootPath = path.resolve('testRoot');
        const info = createMSBuildWorkspaceInformation(path.join(rootPath, 'testApp.csproj'), 'testApp', 'netcoreapp3.0', /*isExe*/ true, /*isWebProject*/ true, /*isBlazorWebAssemblyStandalone*/ false, /*isBlazorWebAssemblyHosted*/ true);
        const generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        const launchJson = parse(generator.createLaunchJsonConfigurations(ProgramLaunchType.BlazorWebAssemblyHosted), undefined, { disallowComments: true });
        const hostedServerLaunchConfig = launchJson[0];
        const chromeLaunchConfig = launchJson[1];
        const programPath = hostedServerLaunchConfig.program;
        const chromeWebRoot = chromeLaunchConfig.webRoot;

        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'bin', 'Debug', 'netcoreapp3.0', 'testApp.dll']);
        chromeWebRoot.should.equal('${workspaceFolder}');
    });

    test("Create launch.json for nested Blazor web assembly hosted project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'nested', 'testApp.csproj'), 'testApp', 'netcoreapp3.0', /*isExe*/ true, /*isWebProject*/ true, /*isBlazorWebAssemblyStandalone*/ false, /*isBlazorWebAssemblyHosted*/ true);
        let generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        let launchJson = parse(generator.createLaunchJsonConfigurations(ProgramLaunchType.BlazorWebAssemblyHosted), undefined, { disallowComments: true });
        const hostedServerLaunchConfig = launchJson[0];
        const chromeLaunchConfig = launchJson[1];
        const programPath = hostedServerLaunchConfig.program;
        const chromeWebRoot = chromeLaunchConfig.webRoot;

        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'nested', 'bin', 'Debug', 'netcoreapp3.0', 'testApp.dll']);
        chromeWebRoot.should.equal('${workspaceFolder}/nested');
    });

    test("Create launch.json for web project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'testApp.csproj'), 'testApp', 'netcoreapp1.0', /*isExe*/ true, /*isWebProject*/ true);
        let generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        let launchJson = parse(generator.createLaunchJsonConfigurations(ProgramLaunchType.Web), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for nested web project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let info = createMSBuildWorkspaceInformation(path.join(rootPath, 'nested', 'testApp.csproj'), 'testApp', 'netcoreapp1.0', /*isExe*/ true, /*isWebProject*/ true);
        let generator = new AssetGenerator(info, createMockWorkspaceFolder(rootPath));
        generator.setStartupProject(0);
        let launchJson = parse(generator.createLaunchJsonConfigurations(ProgramLaunchType.Web), undefined, { disallowComments: true });
        let programPath = launchJson[0].program;

        // ${workspaceFolder}/nested/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.posix.sep);
        segments.should.deep.equal(['${workspaceFolder}', 'nested', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });
});

function createMockWorkspaceFolder(rootPath: string): vscode.WorkspaceFolder {
    return {
        uri: vscode.Uri.file(rootPath),
        name: undefined,
        index: undefined
    };
}

function createMSBuildWorkspaceInformation(projectPath: string, assemblyName: string, targetFrameworkShortName: string, isExe: boolean = true, isWebProject: boolean = false, isBlazorWebAssemblyStandalone: boolean = false, isBlazorWebAssemblyHosted: boolean = false): protocol.WorkspaceInformationResponse {
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
                    IsUnityProject: false,
                    IsWebProject: isWebProject,
                    IsBlazorWebAssemblyHosted: isBlazorWebAssemblyHosted,
                    IsBlazorWebAssemblyStandalone: isBlazorWebAssemblyStandalone,
                }
            ],
        }
    };
}
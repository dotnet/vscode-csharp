/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { createLaunchJson, createTasksConfiguration, Paths, TargetProjectData } from '../src/assets';

suite("Asset generation", () => {
    suiteSetup(() => should());

    test("Create tasks.json for project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let vscodeFolder = path.join(rootPath, '.vscode');
        let tasksJsonPath = path.join(vscodeFolder, 'tasks.json');
        let launchJsonPath = path.join(vscodeFolder, 'launch.json');

        let paths: Paths = { rootPath, vscodeFolder, tasksJsonPath, launchJsonPath };

        let projectData: TargetProjectData = {
            projectPath: vscode.Uri.file(rootPath),
            projectJsonPath: vscode.Uri.file(path.join(rootPath, 'project.json')),
            targetFramework: 'netcoreapp1.0',
            executableName: 'testApp.dll',
            configurationName: 'Debug'
        };

        let tasksJson = createTasksConfiguration(projectData, paths);

        let buildPath = tasksJson.tasks[0].args[0];

        // ${workspaceRoot}/project.json
        let segments = buildPath.split(path.sep);
        segments.should.deep.equal(['${workspaceRoot}', 'project.json']);
    });

    test("Create tasks.json for nested project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let vscodeFolder = path.join(rootPath, '.vscode');
        let tasksJsonPath = path.join(vscodeFolder, 'tasks.json');
        let launchJsonPath = path.join(vscodeFolder, 'launch.json');

        let paths: Paths = { rootPath, vscodeFolder, tasksJsonPath, launchJsonPath };

        let projectData: TargetProjectData = {
            projectPath: vscode.Uri.file(path.join(rootPath, 'nested')),
            projectJsonPath: vscode.Uri.file(path.join(rootPath, 'nested', 'project.json')),
            targetFramework: 'netcoreapp1.0',
            executableName: 'testApp.dll',
            configurationName: 'Debug'
        };

        let tasksJson = createTasksConfiguration(projectData, paths);

        let buildPath = tasksJson.tasks[0].args[0];

        // ${workspaceRoot}/nested/project.json
        let segments = buildPath.split(path.sep);
        segments.should.deep.equal(['${workspaceRoot}', 'nested', 'project.json']);
    });

    test("Create launch.json for project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let vscodeFolder = path.join(rootPath, '.vscode');
        let tasksJsonPath = path.join(vscodeFolder, 'tasks.json');
        let launchJsonPath = path.join(vscodeFolder, 'launch.json');

        let paths: Paths = { rootPath, vscodeFolder, tasksJsonPath, launchJsonPath };

        let projectData: TargetProjectData = {
            projectPath: vscode.Uri.file(path.join(rootPath)),
            projectJsonPath: vscode.Uri.file(path.join(rootPath, 'project.json')),
            targetFramework: 'netcoreapp1.0',
            executableName: 'testApp.dll',
            configurationName: 'Debug'
        };

        let launchJson = createLaunchJson(projectData, paths, /*isWebProject*/ false);

        let programPath = launchJson.configurations[0].program;

        // ${workspaceRoot}/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.sep);
        segments.should.deep.equal(['${workspaceRoot}', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for nested project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let vscodeFolder = path.join(rootPath, '.vscode');
        let tasksJsonPath = path.join(vscodeFolder, 'tasks.json');
        let launchJsonPath = path.join(vscodeFolder, 'launch.json');

        let paths: Paths = { rootPath, vscodeFolder, tasksJsonPath, launchJsonPath };

        let projectData: TargetProjectData = {
            projectPath: vscode.Uri.file(path.join(rootPath, 'nested')),
            projectJsonPath: vscode.Uri.file(path.join(rootPath, 'nested', 'project.json')),
            targetFramework: 'netcoreapp1.0',
            executableName: 'testApp.dll',
            configurationName: 'Debug'
        };

        let launchJson = createLaunchJson(projectData, paths, /*isWebProject*/ false);

        let programPath = launchJson.configurations[0].program;

        // ${workspaceRoot}/nested/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.sep);
        segments.should.deep.equal(['${workspaceRoot}', 'nested', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for web project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let vscodeFolder = path.join(rootPath, '.vscode');
        let tasksJsonPath = path.join(vscodeFolder, 'tasks.json');
        let launchJsonPath = path.join(vscodeFolder, 'launch.json');

        let paths: Paths = { rootPath, vscodeFolder, tasksJsonPath, launchJsonPath };

        let projectData: TargetProjectData = {
            projectPath: vscode.Uri.file(path.join(rootPath)),
            projectJsonPath: vscode.Uri.file(path.join(rootPath, 'project.json')),
            targetFramework: 'netcoreapp1.0',
            executableName: 'testApp.dll',
            configurationName: 'Debug'
        };

        let launchJson = createLaunchJson(projectData, paths, /*isWebProject*/ true);

        let programPath = launchJson.configurations[0].program;

        // ${workspaceRoot}/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.sep);
        segments.should.deep.equal(['${workspaceRoot}', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });

    test("Create launch.json for nested web project opened in workspace", () => {
        let rootPath = path.resolve('testRoot');
        let vscodeFolder = path.join(rootPath, '.vscode');
        let tasksJsonPath = path.join(vscodeFolder, 'tasks.json');
        let launchJsonPath = path.join(vscodeFolder, 'launch.json');

        let paths: Paths = { rootPath, vscodeFolder, tasksJsonPath, launchJsonPath };

        let projectData: TargetProjectData = {
            projectPath: vscode.Uri.file(path.join(rootPath, 'nested')),
            projectJsonPath: vscode.Uri.file(path.join(rootPath, 'nested', 'project.json')),
            targetFramework: 'netcoreapp1.0',
            executableName: 'testApp.dll',
            configurationName: 'Debug'
        };

        let launchJson = createLaunchJson(projectData, paths, /*isWebProject*/ true);

        let programPath = launchJson.configurations[0].program;

        // ${workspaceRoot}/nested/bin/Debug/netcoreapp1.0/testApp.dll
        let segments = programPath.split(path.sep);
        segments.should.deep.equal(['${workspaceRoot}', 'nested', 'bin', 'Debug', 'netcoreapp1.0', 'testApp.dll']);
    });
});

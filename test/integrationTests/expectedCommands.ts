/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const OmniSharpCommands = [
    'o.restart',
    'o.pickProjectAndStart',
    'o.fixAll.solution',
    'o.fixAll.project',
    'o.fixAll.document',
    'o.reanalyze.allProjects',
    'o.reanalyze.currentProject',
];

export const RoslynCommands = ['dotnet.openSolution', 'dotnet.restartServer'];

export const CommonCommands = [
    'dotnet.generateAssets',
    'dotnet.restore.project',
    'dotnet.restore.all',
    'dotnet.test.runTestsInContext',
    'dotnet.test.debugTestsInContext',
    'csharp.listProcess',
    'csharp.listRemoteProcess',
    'csharp.listRemoteDockerProcess',
    'csharp.attachToProcess',
    'csharp.reportIssue',
];

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Commands used by all activation contexts of the extension.
const CommonCommands = [
    'dotnet.generateAssets',
    'csharp.listProcess',
    'csharp.listRemoteProcess',
    'csharp.listRemoteDockerProcess',
    'csharp.attachToProcess',
    'csharp.reportIssue',
];

// Commands used in a Roslyn standalone activation context.
const CommonStandaloneCommands = [
    'dotnet.restore.project',
    'dotnet.restore.all',
    'dotnet.test.runTestsInContext',
    'dotnet.test.debugTestsInContext',
];

// Commands used only in a Roslyn activation context.
const RoslynCommonCommands = ['dotnet.restartServer'];

// Commands used only in a Roslyn standalone activation context.
const RoslynStandaloneOnlyCommands = ['dotnet.openSolution'];

// All commands used in a Roslyn standalone activation context.
export const RoslynStandaloneCommands = [
    ...CommonCommands,
    ...CommonStandaloneCommands,
    ...RoslynCommonCommands,
    ...RoslynStandaloneOnlyCommands,
];

// All commands used in a Roslyn + C# Dev Kit activation context.
export const RoslynDevKitCommands = [...CommonCommands, ...RoslynCommonCommands];

// All commands that should not be available in a Roslyn standalone activation context.
export const UnexpectedRoslynStandaloneCommands: string[] = [];

// All commands that should not be available in a Roslyn + C# Dev Kit activation context.
export const UnexpectedRoslynDevKitCommands = [...CommonStandaloneCommands, ...RoslynStandaloneOnlyCommands];

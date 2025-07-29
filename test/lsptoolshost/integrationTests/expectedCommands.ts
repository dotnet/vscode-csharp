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

// Commands used by both O# and Roslyn standalone activation contexts.
const CommonStandaloneCommands = [
    'dotnet.restore.project',
    'dotnet.restore.all',
    'dotnet.test.runTestsInContext',
    'dotnet.test.debugTestsInContext',
];

// Commands used only in an O# activation context.
const OmniSharpOnlyCommands = [
    'o.restart',
    'o.pickProjectAndStart',
    'o.fixAll.solution',
    'o.fixAll.project',
    'o.fixAll.document',
    'o.reanalyze.allProjects',
    'o.reanalyze.currentProject',
];

// All commands used in the O# activation context.
export const OmniSharpCommands = [...OmniSharpOnlyCommands, ...CommonCommands, ...CommonStandaloneCommands];

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

// All commands that should not be available in an O# activation context.
export const UnexpectedOmniSharpCommands = [...RoslynStandaloneOnlyCommands, ...RoslynCommonCommands];

// All commands that should not be available in a Roslyn standalone activation context.
export const UnexpectedRoslynStandaloneCommands = [...OmniSharpOnlyCommands];

// All commands that should not be available in a Roslyn + C# Dev Kit activation context.
export const UnexpectedRoslynDevKitCommands = [
    ...CommonStandaloneCommands,
    ...OmniSharpOnlyCommands,
    ...RoslynStandaloneOnlyCommands,
];

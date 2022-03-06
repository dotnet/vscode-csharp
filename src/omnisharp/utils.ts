/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import { OmniSharpServer } from './server';
import * as path from 'path';
import * as protocol from './protocol';
import * as vscode from 'vscode';
import { MSBuildProject } from './protocol';
import { CancellationToken } from 'vscode-languageserver-protocol';

export async function codeCheck(server: OmniSharpServer, request: protocol.Request, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.QuickFixResponse>(protocol.Requests.CodeCheck, request, token);
}

export async function blockStructure(server: OmniSharpServer, request: protocol.V2.BlockStructureRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.V2.BlockStructureResponse>(protocol.V2.Requests.BlockStructure, request, token);
}

export async function codeStructure(server: OmniSharpServer, request: protocol.V2.Structure.CodeStructureRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.V2.Structure.CodeStructureResponse>(protocol.V2.Requests.CodeStructure, request, token);
}

export async function discoverTests(server: OmniSharpServer, request: protocol.V2.DiscoverTestsRequest) {
    return server.makeRequest<protocol.V2.DiscoverTestsResponse>(protocol.V2.Requests.DiscoverTests, request);
}

export async function filesChanged(server: OmniSharpServer, requests: protocol.Request[]) {
    return server.makeRequest<void>(protocol.Requests.FilesChanged, requests);
}

export async function findImplementations(server: OmniSharpServer, request: protocol.FindImplementationsRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.QuickFixResponse>(protocol.Requests.FindImplementations, request);
}

export async function findSymbols(server: OmniSharpServer, request: protocol.FindSymbolsRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.FindSymbolsResponse>(protocol.Requests.FindSymbols, request, token);
}

export async function runFixAll(server: OmniSharpServer, request: protocol.RunFixAllRequest): Promise<protocol.RunFixAllActionResponse> {
    return server.makeRequest<protocol.RunFixAllActionResponse>(protocol.Requests.RunFixAll, request);
}

export async function getFixAll(server: OmniSharpServer, request: protocol.GetFixAllRequest): Promise<protocol.GetFixAllResponse> {
    return server.makeRequest<protocol.GetFixAllResponse>(protocol.Requests.GetFixAll, request);
}

export async function findUsages(server: OmniSharpServer, request: protocol.FindUsagesRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.QuickFixResponse>(protocol.Requests.FindUsages, request, token);
}

export async function formatAfterKeystroke(server: OmniSharpServer, request: protocol.FormatAfterKeystrokeRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.FormatRangeResponse>(protocol.Requests.FormatAfterKeystroke, request, token);
}

export async function formatRange(server: OmniSharpServer, request: protocol.FormatRangeRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.FormatRangeResponse>(protocol.Requests.FormatRange, request, token);
}

export async function getCodeActions(server: OmniSharpServer, request: protocol.V2.GetCodeActionsRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.V2.GetCodeActionsResponse>(protocol.V2.Requests.GetCodeActions, request, token);
}

export async function goToDefinition(server: OmniSharpServer, request: protocol.V2.GoToDefinitionRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.V2.GoToDefinitionResponse>(protocol.V2.Requests.GoToDefinition, request, token);
}

export async function goToTypeDefinition(server: OmniSharpServer, request: protocol.GoToTypeDefinitionRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.GoToTypeDefinitionResponse>(protocol.Requests.GoToTypeDefinition, request, token);
}

export async function getSourceGeneratedFile(server: OmniSharpServer, request: protocol.SourceGeneratedFileRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.SourceGeneratedFileResponse>(protocol.Requests.SourceGeneratedFile, request, token);
}

export async function getUpdatedSourceGeneratedFile(server: OmniSharpServer, request: protocol.UpdateSourceGeneratedFileRequest) {
    return server.makeRequest<protocol.UpdateSourceGeneratedFileResponse>(protocol.Requests.UpdateSourceGeneratedFile, request);
}

export async function sourceGeneratedFileClosed(server: OmniSharpServer, request: protocol.SourceGeneratedFileRequest) {
    return server.makeRequest(protocol.Requests.SourceGeneratedFileClosed, request);
}

export async function rename(server: OmniSharpServer, request: protocol.RenameRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.RenameResponse>(protocol.Requests.Rename, request, token);
}

export async function requestProjectInformation(server: OmniSharpServer, request: protocol.Request) {
    return server.makeRequest<protocol.ProjectInformationResponse>(protocol.Requests.Project, request);
}

export async function requestWorkspaceInformation(server: OmniSharpServer) {
    const response = await server.makeRequest<protocol.WorkspaceInformationResponse>(protocol.Requests.Projects);
    if (response.MsBuild && response.MsBuild.Projects) {
        let blazorWebAssemblyProjectFound = false;

        for (const project of response.MsBuild.Projects) {
            project.IsWebProject = isWebProject(project);

            const isProjectBlazorWebAssemblyProject = await isBlazorWebAssemblyProject(project);
            const isProjectBlazorWebAssemblyHosted = isBlazorWebAssemblyHosted(project, isProjectBlazorWebAssemblyProject);

            project.IsBlazorWebAssemblyHosted = isProjectBlazorWebAssemblyHosted;
            project.IsBlazorWebAssemblyStandalone = isProjectBlazorWebAssemblyProject && !project.IsBlazorWebAssemblyHosted;

            blazorWebAssemblyProjectFound = blazorWebAssemblyProjectFound || isProjectBlazorWebAssemblyProject;
        }

        if (blazorWebAssemblyProjectFound && !vscode.extensions.getExtension('ms-dotnettools.blazorwasm-companion')) {
            // No need to await this call, we don't depend on the prompt being shown.
            showBlazorDebuggingExtensionPrompt(server);
        }
    }

    return response;
}

export async function runCodeAction(server: OmniSharpServer, request: protocol.V2.RunCodeActionRequest) {
    return server.makeRequest<protocol.V2.RunCodeActionResponse>(protocol.V2.Requests.RunCodeAction, request);
}

export async function signatureHelp(server: OmniSharpServer, request: protocol.Request, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.SignatureHelp>(protocol.Requests.SignatureHelp, request, token);
}

export async function typeLookup(server: OmniSharpServer, request: protocol.TypeLookupRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.TypeLookupResponse>(protocol.Requests.TypeLookup, request, token);
}

export async function updateBuffer(server: OmniSharpServer, request: protocol.UpdateBufferRequest) {
    return server.makeRequest<boolean>(protocol.Requests.UpdateBuffer, request);
}

export async function getMetadata(server: OmniSharpServer, request: protocol.MetadataRequest) {
    return server.makeRequest<protocol.MetadataResponse>(protocol.Requests.Metadata, request);
}

export async function reAnalyze(server: OmniSharpServer, request: any) {
    return server.makeRequest<any>(protocol.Requests.ReAnalyze, request);
}

export async function getTestStartInfo(server: OmniSharpServer, request: protocol.V2.GetTestStartInfoRequest) {
    return server.makeRequest<protocol.V2.GetTestStartInfoResponse>(protocol.V2.Requests.GetTestStartInfo, request);
}

export async function runTest(server: OmniSharpServer, request: protocol.V2.RunTestRequest) {
    return server.makeRequest<protocol.V2.RunTestResponse>(protocol.V2.Requests.RunTest, request);
}

export async function runTestsInClass(server: OmniSharpServer, request: protocol.V2.RunTestsInClassRequest) {
    return server.makeRequest<protocol.V2.RunTestResponse>(protocol.V2.Requests.RunAllTestsInClass, request);
}

export async function runTestsInContext(server: OmniSharpServer, request: protocol.V2.RunTestsInContextRequest) {
    return server.makeRequest<protocol.V2.RunTestResponse>(protocol.V2.Requests.RunTestsInContext, request);
}

export async function debugTestGetStartInfo(server: OmniSharpServer, request: protocol.V2.DebugTestGetStartInfoRequest) {
    return server.makeRequest<protocol.V2.DebugTestGetStartInfoResponse>(protocol.V2.Requests.DebugTestGetStartInfo, request);
}

export async function debugTestClassGetStartInfo(server: OmniSharpServer, request: protocol.V2.DebugTestClassGetStartInfoRequest) {
    return server.makeRequest<protocol.V2.DebugTestGetStartInfoResponse>(protocol.V2.Requests.DebugTestsInClassGetStartInfo, request);
}

export async function debugTestsInContextGetStartInfo(server: OmniSharpServer, request: protocol.V2.DebugTestsInContextGetStartInfoRequest) {
    return server.makeRequest<protocol.V2.DebugTestGetStartInfoResponse>(protocol.V2.Requests.DebugTestsInContextGetStartInfo, request);
}

export async function debugTestLaunch(server: OmniSharpServer, request: protocol.V2.DebugTestLaunchRequest) {
    return server.makeRequest<protocol.V2.DebugTestLaunchResponse>(protocol.V2.Requests.DebugTestLaunch, request);
}

export async function debugTestStop(server: OmniSharpServer, request: protocol.V2.DebugTestStopRequest) {
    return server.makeRequest<protocol.V2.DebugTestStopResponse>(protocol.V2.Requests.DebugTestStop, request);
}

export async function getSemanticHighlights(server: OmniSharpServer, request: protocol.V2.SemanticHighlightRequest) {
    return server.makeRequest<protocol.V2.SemanticHighlightResponse>(protocol.V2.Requests.Highlight, request);
}

export async function getQuickInfo(server: OmniSharpServer, request: protocol.QuickInfoRequest, token: CancellationToken) {
    return server.makeRequest<protocol.QuickInfoResponse>(protocol.Requests.QuickInfo, request, token);
}

export async function getCompletion(server: OmniSharpServer, request: protocol.CompletionRequest, context: vscode.CancellationToken) {
    return server.makeRequest<protocol.CompletionResponse>(protocol.Requests.Completion, request, context);
}

export async function getCompletionResolve(server: OmniSharpServer, request: protocol.CompletionResolveRequest, context: vscode.CancellationToken) {
    return server.makeRequest<protocol.CompletionResolveResponse>(protocol.Requests.CompletionResolve, request, context);
}

export async function getCompletionAfterInsert(server: OmniSharpServer, request: protocol.CompletionAfterInsertionRequest) {
    return server.makeRequest<protocol.CompletionAfterInsertResponse>(protocol.Requests.CompletionAfterInsert, request);
}

export async function isNetCoreProject(project: protocol.MSBuildProject) {
    return project.TargetFrameworks.find(tf => tf.ShortName.startsWith('netcoreapp') || tf.ShortName.startsWith('netstandard')) !== undefined;
}

function isBlazorWebAssemblyHosted(project: protocol.MSBuildProject, isProjectBlazorWebAssemblyProject: boolean): boolean {
    if (!isProjectBlazorWebAssemblyProject) {
        return false;
    }

    if (!project.IsExe) {
        return false;
    }

    if (!project.IsWebProject) {
        return false;
    }

    if (protocol.findNetCoreAppTargetFramework(project) === undefined) {
        return false;
    }

    return true;
}

async function isBlazorWebAssemblyProject(project: MSBuildProject): Promise<boolean> {
    const projectDirectory = path.dirname(project.Path);
    const launchSettingsPath = path.join(projectDirectory, 'Properties', 'launchSettings.json');

    try {
        if (!fs.pathExistsSync(launchSettingsPath)) {
            return false;
        }

        const launchSettingContent = fs.readFileSync(launchSettingsPath);
        if (!launchSettingContent) {
            return false;
        }

        if (launchSettingContent.indexOf('"inspectUri"') > 0) {
            return true;
        }
    } catch {
        // Swallow IO errors from reading the launchSettings.json files
    }

    return false;
}

function isWebProject(project: MSBuildProject): boolean {
    let projectFileText = fs.readFileSync(project.Path, 'utf8');

    // Assume that this is an MSBuild project. In that case, look for the 'Sdk="Microsoft.NET.Sdk.Web"' attribute.
    // TODO: Have OmniSharp provide the list of SDKs used by a project and check that list instead.
    return projectFileText.toLowerCase().indexOf('sdk="microsoft.net.sdk.web"') >= 0;
}

async function showBlazorDebuggingExtensionPrompt(server: OmniSharpServer) {
    const promptShownKey = 'blazor_debugging_extension_prompt_shown';
    if (!server.sessionProperties[promptShownKey]) {
        server.sessionProperties[promptShownKey] = true;

        const msg = 'The Blazor WASM Debugging Extension is required to debug Blazor WASM apps in VS Code.';
        const result = await vscode.window.showInformationMessage(msg, 'Install Extension', 'Close');
        if (result === 'Install Extension') {
            const uriToOpen = vscode.Uri.parse('vscode:extension/ms-dotnettools.blazorwasm-companion');
            await vscode.commands.executeCommand('vscode.open', uriToOpen);
        }
    }
}

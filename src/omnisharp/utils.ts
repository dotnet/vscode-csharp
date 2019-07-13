/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmniSharpServer } from './server';
import * as protocol from './protocol';
import * as vscode from 'vscode';

export async function autoComplete(server: OmniSharpServer, request: protocol.AutoCompleteRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.AutoCompleteResponse[]>(protocol.Requests.AutoComplete, request, token);
}

export async function codeCheck(server: OmniSharpServer, request: protocol.Request, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.QuickFixResponse>(protocol.Requests.CodeCheck, request, token);
}

export async function blockStructure(server: OmniSharpServer, request: protocol.V2.BlockStructureRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.V2.BlockStructureResponse>(protocol.V2.Requests.BlockStructure, request, token);
}

export async function codeStructure(server: OmniSharpServer, request: protocol.V2.Structure.CodeStructureRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.V2.Structure.CodeStructureResponse>(protocol.V2.Requests.CodeStructure, request, token);
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

export async function goToDefinition(server: OmniSharpServer, request: protocol.GoToDefinitionRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.GoToDefinitionResponse>(protocol.Requests.GoToDefinition, request);
}

export async function rename(server: OmniSharpServer, request: protocol.RenameRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.RenameResponse>(protocol.Requests.Rename, request, token);
}

export async function requestProjectInformation(server: OmniSharpServer, request: protocol.Request) {
    return server.makeRequest<protocol.ProjectInformationResponse>(protocol.Requests.Project, request);
}

export async function requestWorkspaceInformation(server: OmniSharpServer) {
    return server.makeRequest<protocol.WorkspaceInformationResponse>(protocol.Requests.Projects);
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

export async function debugTestGetStartInfo(server: OmniSharpServer, request: protocol.V2.DebugTestGetStartInfoRequest) {
    return server.makeRequest<protocol.V2.DebugTestGetStartInfoResponse>(protocol.V2.Requests.DebugTestGetStartInfo, request);
}

export async function debugTestClassGetStartInfo(server: OmniSharpServer, request: protocol.V2.DebugTestClassGetStartInfoRequest) {
    return server.makeRequest<protocol.V2.DebugTestGetStartInfoResponse>(protocol.V2.Requests.DebugTestsInClassGetStartInfo, request);
}

export async function debugTestLaunch(server: OmniSharpServer, request: protocol.V2.DebugTestLaunchRequest) {
    return server.makeRequest<protocol.V2.DebugTestLaunchResponse>(protocol.V2.Requests.DebugTestLaunch, request);
}

export async function debugTestStop(server: OmniSharpServer, request: protocol.V2.DebugTestStopRequest) {
    return server.makeRequest<protocol.V2.DebugTestStopResponse>(protocol.V2.Requests.DebugTestStop, request);
}

export async function isNetCoreProject(project: protocol.MSBuildProject) {
    return project.TargetFrameworks.find(tf => tf.ShortName.startsWith('netcoreapp') || tf.ShortName.startsWith('netstandard')) !== undefined;
}
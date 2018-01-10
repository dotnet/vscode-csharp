/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { OmniSharpServer } from './server';
import * as protocol from './protocol';
import * as vscode from 'vscode';

export function autoComplete(server: OmniSharpServer, request: protocol.AutoCompleteRequest) {
    return server.makeRequest<protocol.AutoCompleteResponse[]>(protocol.Requests.AutoComplete, request);
}

export function codeCheck(server: OmniSharpServer, request: protocol.Request, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.QuickFixResponse>(protocol.Requests.CodeCheck, request, token);
}

export function currentFileMembersAsTree(server: OmniSharpServer, request: protocol.Request, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.CurrentFileMembersAsTreeResponse>(protocol.Requests.CurrentFileMembersAsTree, request, token);
}

export function filesChanged(server: OmniSharpServer, requests: protocol.Request[]) {
    return server.makeRequest<void>(protocol.Requests.FilesChanged, requests);
}

export function findImplementations(server: OmniSharpServer, request: protocol.FindImplementationsRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.QuickFixResponse>(protocol.Requests.FindImplementations, request);
}

export function findSymbols(server: OmniSharpServer, request: protocol.FindSymbolsRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.FindSymbolsResponse>(protocol.Requests.FindSymbols, request, token);
}

export function findUsages(server: OmniSharpServer, request: protocol.FindUsagesRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.QuickFixResponse>(protocol.Requests.FindUsages, request, token);
}

export function formatAfterKeystroke(server: OmniSharpServer, request: protocol.FormatAfterKeystrokeRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.FormatRangeResponse>(protocol.Requests.FormatAfterKeystroke, request, token);
}

export function formatRange(server: OmniSharpServer, request: protocol.FormatRangeRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.FormatRangeResponse>(protocol.Requests.FormatRange, request, token);
}

export function getCodeActions(server: OmniSharpServer, request: protocol.V2.GetCodeActionsRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.V2.GetCodeActionsResponse>(protocol.V2.Requests.GetCodeActions, request, token);
}

export function goToDefinition(server: OmniSharpServer, request: protocol.GoToDefinitionRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.GoToDefinitionResponse>(protocol.Requests.GoToDefinition, request);
}

export function rename(server: OmniSharpServer, request: protocol.RenameRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.RenameResponse>(protocol.Requests.Rename, request, token);
}

export function requestProjectInformation(server: OmniSharpServer, request: protocol.Request) {
    return server.makeRequest<protocol.ProjectInformationResponse>(protocol.Requests.Project, request);
}

export function requestWorkspaceInformation(server: OmniSharpServer) {
    return server.makeRequest<protocol.WorkspaceInformationResponse>(protocol.Requests.Projects);
}

export function runCodeAction(server: OmniSharpServer, request: protocol.V2.RunCodeActionRequest) {
    return server.makeRequest<protocol.V2.RunCodeActionResponse>(protocol.V2.Requests.RunCodeAction, request);
}

export function signatureHelp(server: OmniSharpServer, request: protocol.Request, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.SignatureHelp>(protocol.Requests.SignatureHelp, request, token);
}

export function typeLookup(server: OmniSharpServer, request: protocol.TypeLookupRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.TypeLookupResponse>(protocol.Requests.TypeLookup, request, token);
}

export function updateBuffer(server: OmniSharpServer, request: protocol.UpdateBufferRequest) {
    return server.makeRequest<boolean>(protocol.Requests.UpdateBuffer, request);
}

export function getMetadata(server: OmniSharpServer, request: protocol.MetadataRequest) {
    return server.makeRequest<protocol.MetadataResponse>(protocol.Requests.Metadata, request);
}

export function getTestStartInfo(server: OmniSharpServer, request: protocol.V2.GetTestStartInfoRequest) {
    return server.makeRequest<protocol.V2.GetTestStartInfoResponse>(protocol.V2.Requests.GetTestStartInfo, request);
}

export function runTest(server: OmniSharpServer, request: protocol.V2.RunTestRequest) {
    return server.makeRequest<protocol.V2.RunTestResponse>(protocol.V2.Requests.RunTest, request);
}

export function runTestsInClass(server: OmniSharpServer, request: protocol.V2.RunTestsInClassRequest) {
    return server.makeRequest<protocol.V2.RunTestResponse[]>(protocol.V2.Requests.RunAllTestsInClass, request);
}

export function debugTestGetStartInfo(server: OmniSharpServer, request: protocol.V2.DebugTestGetStartInfoRequest) {
    return server.makeRequest<protocol.V2.DebugTestGetStartInfoResponse>(protocol.V2.Requests.DebugTestGetStartInfo, request);
}

export function debugTestClassGetStartInfo(server: OmniSharpServer, request: protocol.V2.DebugTestClassGetStartInfoRequest) {
    return server.makeRequest<protocol.V2.DebugTestGetStartInfoResponse>(protocol.V2.Requests.DebugTestsInClassGetStartInfo, request);
}

export function debugTestLaunch(server: OmniSharpServer, request: protocol.V2.DebugTestLaunchRequest) {
    return server.makeRequest<protocol.V2.DebugTestLaunchResponse>(protocol.V2.Requests.DebugTestLaunch, request);
}

export function debugTestStop(server: OmniSharpServer, request: protocol.V2.DebugTestStopRequest) {
    return server.makeRequest<protocol.V2.DebugTestStopResponse>(protocol.V2.Requests.DebugTestStop, request);
}

export function isNetCoreProject(project: protocol.MSBuildProject) {
    return project.TargetFrameworks.find(tf => tf.ShortName.startsWith('netcoreapp') || tf.ShortName.startsWith('netstandard')) !== undefined;
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {OmnisharpServer} from './omnisharpServer';
import * as protocol from './protocol';
import * as vscode from 'vscode';

export function autoComplete(server: OmnisharpServer, request: protocol.AutoCompleteRequest) {
    return server.makeRequest<protocol.AutoCompleteResponse[]>(protocol.Requests.AutoComplete, request);
}

export function codeCheck(server: OmnisharpServer, request: protocol.Request, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.QuickFixResponse>(protocol.Requests.CodeCheck, request, token);
}

export function currentFileMembersAsTree(server: OmnisharpServer, request: protocol.Request, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.CurrentFileMembersAsTreeResponse>(protocol.Requests.CurrentFileMembersAsTree, request, token);
}

export function filesChanged(server: OmnisharpServer, requests: protocol.Request[]) {
    return server.makeRequest<void>(protocol.Requests.FilesChanged, requests);
}

export function findSymbols(server: OmnisharpServer, request: protocol.FindSymbolsRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.FindSymbolsResponse>(protocol.Requests.FindSymbols, request, token);
}

export function findUsages(server: OmnisharpServer, request: protocol.FindUsagesRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.QuickFixResponse>(protocol.Requests.FindUsages, request, token);
}

export function formatAfterKeystroke(server: OmnisharpServer, request: protocol.FormatAfterKeystrokeRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.FormatRangeResponse>(protocol.Requests.FormatAfterKeystroke, request, token);
}

export function formatRange(server: OmnisharpServer, request: protocol.FormatRangeRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.FormatRangeResponse>(protocol.Requests.FormatRange, request, token);
}

export function getCodeActions(server: OmnisharpServer, request: protocol.V2.GetCodeActionsRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.V2.GetCodeActionsResponse>(protocol.V2.Requests.GetCodeActions, request, token);
}

export function goToDefinition(server: OmnisharpServer, request: protocol.Request, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.ResourceLocation>(protocol.Requests.GoToDefinition, request);
}

export function rename(server: OmnisharpServer, request: protocol.RenameRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.RenameResponse>(protocol.Requests.Rename, request, token);
}

export function requestWorkspaceInformation(server: OmnisharpServer) {
    return server.makeRequest<protocol.WorkspaceInformationResponse>(protocol.Requests.Projects);
}

export function runCodeAction(server: OmnisharpServer, request: protocol.V2.RunCodeActionRequest) {
    return server.makeRequest<protocol.V2.RunCodeActionResponse>(protocol.V2.Requests.RunCodeAction, request);
}

export function signatureHelp(server: OmnisharpServer, request: protocol.Request, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.SignatureHelp>(protocol.Requests.SignatureHelp, request, token);
}

export function typeLookup(server: OmnisharpServer, request: protocol.TypeLookupRequest, token: vscode.CancellationToken) {
    return server.makeRequest<protocol.TypeLookupResponse>(protocol.Requests.TypeLookup, request, token);
}

export function updateBuffer(server: OmnisharpServer, request: protocol.UpdateBufferRequest) {
    return server.makeRequest<boolean>(protocol.Requests.UpdateBuffer, request);
}

export function getTestStartInfo(server: OmnisharpServer, request: protocol.V2.GetTestStartInfoRequest) {
    return server.makeRequest<protocol.V2.GetTestStartInfoResponse>(protocol.V2.Requests.GetTestStartInfo, request);
}

export function runDotNetTest(server: OmnisharpServer, request: protocol.V2.RunDotNetTestRequest) {
    return server.makeRequest<protocol.V2.RunDotNetTestResponse>(protocol.V2.Requests.RunDotNetTest, request);
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RoslynLanguageServer } from './roslynLanguageServer';
import * as vscode from 'vscode';
import {
    DidChangeTextDocumentNotification,
    DidCloseTextDocumentNotification,
    DidCloseTextDocumentParams,
    DidChangeTextDocumentParams,
    DocumentDiagnosticParams,
    RequestType,
    DocumentDiagnosticRequest,
    DocumentDiagnosticReport,
    CancellationToken,
    CodeAction,
    CodeActionParams,
    CodeActionRequest,
    CodeActionResolveRequest,
    CompletionParams,
    CompletionRequest,
    CompletionResolveRequest,
    CompletionItem,
} from 'vscode-languageclient/node';
import SerializableSimplifyMethodParams from '../razor/src/simplify/serializableSimplifyMethodParams';
import { TextEdit } from 'vscode-html-languageservice';
import { SerializableFormatNewFileParams } from '../razor/src/formatNewFile/serializableFormatNewFileParams';

// These are commands that are invoked by the Razor extension, and are used to send LSP requests to the Roslyn LSP server
export const roslynDidChangeCommand = 'roslyn.changeRazorCSharp';
export const roslynDidCloseCommand = 'roslyn.closeRazorCSharp';
export const roslynPullDiagnosticCommand = 'roslyn.pullDiagnosticRazorCSharp';
export const provideCodeActionsCommand = 'roslyn.provideCodeActions';
export const resolveCodeActionCommand = 'roslyn.resolveCodeAction';
export const provideCompletionsCommand = 'roslyn.provideCompletions';
export const resolveCompletionsCommand = 'roslyn.resolveCompletion';
export const roslynSimplifyMethodCommand = 'roslyn.simplifyMethod';
export const roslynFormatNewFileCommand = 'roslyn.formatNewFile';
export const razorInitializeCommand = 'razor.initialize';

export function registerRazorCommands(context: vscode.ExtensionContext, languageServer: RoslynLanguageServer) {
    // Razor will call into us (via command) for generated file didChange/didClose notifications. We'll then forward these
    // notifications along to Roslyn. didOpen notifications are handled separately via the vscode.openTextDocument method.
    context.subscriptions.push(
        vscode.commands.registerCommand(roslynDidChangeCommand, async (notification: DidChangeTextDocumentParams) => {
            await languageServer.sendNotification(DidChangeTextDocumentNotification.method, notification);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(roslynDidCloseCommand, async (notification: DidCloseTextDocumentParams) => {
            await languageServer.sendNotification(DidCloseTextDocumentNotification.method, notification);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(roslynPullDiagnosticCommand, async (request: DocumentDiagnosticParams) => {
            const diagnosticRequestType = new RequestType<DocumentDiagnosticParams, DocumentDiagnosticReport, any>(
                DocumentDiagnosticRequest.method
            );
            return await languageServer.sendRequest(diagnosticRequestType, request, CancellationToken.None);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(
            roslynSimplifyMethodCommand,
            async (request: SerializableSimplifyMethodParams) => {
                const simplifyMethodRequestType = new RequestType<SerializableSimplifyMethodParams, TextEdit[], any>(
                    'roslyn/simplifyMethod'
                );
                return await languageServer.sendRequest(simplifyMethodRequestType, request, CancellationToken.None);
            }
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(
            roslynFormatNewFileCommand,
            async (request: SerializableFormatNewFileParams) => {
                const formatNewFileRequestType = new RequestType<
                    SerializableFormatNewFileParams,
                    string | undefined,
                    any
                >('roslyn/formatNewFile');
                return await languageServer.sendRequest(formatNewFileRequestType, request, CancellationToken.None);
            }
        )
    );

    // The VS Code API for code actions (and the vscode.CodeAction type) doesn't support everything that LSP supports,
    // namely the data property, which Razor needs to identify which code actions are on their allow list, so we need
    // to expose a command for them to directly invoke our code actions LSP endpoints, rather than use built-in commands.
    context.subscriptions.push(
        vscode.commands.registerCommand(provideCodeActionsCommand, async (request: CodeActionParams) => {
            return await languageServer.sendRequest(CodeActionRequest.type, request, CancellationToken.None);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(resolveCodeActionCommand, async (request: CodeAction) => {
            return await languageServer.sendRequest(CodeActionResolveRequest.type, request, CancellationToken.None);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(provideCompletionsCommand, async (request: CompletionParams) => {
            return await languageServer.sendRequest(CompletionRequest.type, request, CancellationToken.None);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(resolveCompletionsCommand, async (request: CompletionItem) => {
            return await languageServer.sendRequest(CompletionResolveRequest.type, request, CancellationToken.None);
        })
    );

    // Roslyn is responsible for producing a json file containing information for Razor, that comes from the compilation for
    // a project. We want to defer this work until necessary, so this command is called by the Razor document manager to tell
    // us when they need us to initialize the Razor things.
    context.subscriptions.push(
        vscode.commands.registerCommand(razorInitializeCommand, async () => {
            await languageServer.sendNotification('razor/initialize', {});
        })
    );
}

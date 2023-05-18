/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CodeAction, RequestType, TextDocumentIdentifier } from 'vscode-languageclient';
import { RazorDocumentManager } from '../Document/RazorDocumentManager';
import { RazorLanguageServerClient } from '../RazorLanguageServerClient';
import { RazorLogger } from '../RazorLogger';
import { SerializableDelegatedCodeActionParams } from './SerializableDelegatedCodeActionParams';
import { RoslynLanguageServer } from '../../../lsptoolshost/roslynLanguageServer';
import { LanguageKind } from '../RPC/LanguageKind';
import { UriConverter } from '../../../lsptoolshost/uriConverter';
import { SerializableRazorResolveCodeActionParams } from './SerializableRazorResolveCodeActionParams';
import { RazorDocumentSynchronizer } from '../Document/RazorDocumentSynchronizer';

export class CodeActionsHandler {
    private static readonly provideCodeActionsEndpoint = 'razor/provideCodeActions';
    private static readonly resolveCodeActionsEndpoint = 'razor/resolveCodeActions';
    private codeActionRequestType: RequestType<SerializableDelegatedCodeActionParams, CodeAction[], any> = new RequestType(CodeActionsHandler.provideCodeActionsEndpoint);
    private codeActionResolveRequestType: RequestType<SerializableRazorResolveCodeActionParams, CodeAction, any> = new RequestType(CodeActionsHandler.resolveCodeActionsEndpoint);
    private emptyCodeActionResponse: CodeAction[] = [];
    private emptyCodeAction: CodeAction = <CodeAction>{};

    constructor(
        private readonly documentManager: RazorDocumentManager,
        private readonly documentSynchronizer: RazorDocumentSynchronizer,
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger) { }

    public async register() {
        await this.serverClient.onRequestWithParams<SerializableDelegatedCodeActionParams, CodeAction[], any>(
            this.codeActionRequestType,
            async (request: SerializableDelegatedCodeActionParams, token: vscode.CancellationToken) => this.provideCodeActions(request, token));

        await this.serverClient.onRequestWithParams<SerializableRazorResolveCodeActionParams, CodeAction, any>(
            this.codeActionResolveRequestType,
            async (request: SerializableRazorResolveCodeActionParams, token: vscode.CancellationToken) => this.resolveCodeAction(request, token));
    }

    private async provideCodeActions(
        delegatedCodeActionParams: SerializableDelegatedCodeActionParams,
        token: vscode.CancellationToken) {
        try {
            const codeActionParams = delegatedCodeActionParams.codeActionParams;
            const razorDocumentUri = vscode.Uri.parse(codeActionParams.textDocument.uri, true);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                return this.emptyCodeActionResponse;
            }

            // We only support C# delegated code actions (for now??)
            if (delegatedCodeActionParams.languageKind !== LanguageKind.CSharp) {
                return this.emptyCodeActionResponse;
            }

            if (!this.documentManager.roslynActivated) {
                // Unlike most other handlers, code actions works by directly sending an LSP request to Roslyn, so if Roslyn isn't
                // activated we need to catch that here.
                return this.emptyCodeActionResponse;
            }

            const textDocument = await vscode.workspace.openTextDocument(razorDocumentUri);
            const synchronized = await this.documentSynchronizer.trySynchronizeProjectedDocument(textDocument, razorDocument.csharpDocument, delegatedCodeActionParams.hostDocumentVersion, token);
            if (!synchronized) {
                return this.emptyCodeActionResponse;
            }

            // Point this request to the virtual C# document, and call Roslyn
            const virtualCSharpUri = UriConverter.serialize(razorDocument.csharpDocument.uri);
            codeActionParams.textDocument = TextDocumentIdentifier.create(virtualCSharpUri);

            return <CodeAction[]>await vscode.commands.executeCommand(RoslynLanguageServer.provideCodeActionsCommand, codeActionParams);
        } catch (error) {
            this.logger.logWarning(`${CodeActionsHandler.provideCodeActionsEndpoint} failed with ${error}`);
        }

        return this.emptyCodeActionResponse;
    }

    private async resolveCodeAction(
        resolveCodeActionParams: SerializableRazorResolveCodeActionParams,
        token: vscode.CancellationToken) {
        try {
            const codeAction = resolveCodeActionParams.codeAction;
            const razorDocumentUri = vscode.Uri.parse(resolveCodeActionParams.uri, true);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                return this.emptyCodeAction;
            }

            // We only support C# delegated code actions (for now??)
            if (resolveCodeActionParams.languageKind !== LanguageKind.CSharp) {
                return this.emptyCodeAction;
            }

            const textDocument = await vscode.workspace.openTextDocument(razorDocument.uri);
            const synchronized = await this.documentSynchronizer.trySynchronizeProjectedDocument(textDocument, razorDocument.csharpDocument, resolveCodeActionParams.hostDocumentVersion, token);
            if (!synchronized) {
                return this.emptyCodeAction;
            }

            // Call Roslyn. Since this code action came from Roslyn, we don't even have to point it
            // to the virtual C# document.
            return <CodeAction>await vscode.commands.executeCommand(RoslynLanguageServer.resolveCodeActionCommand, codeAction);
        } catch (error) {
            this.logger.logWarning(`${CodeActionsHandler.resolveCodeActionsEndpoint} failed with ${error}`);
        }

        return this.emptyCodeAction;
    }
}

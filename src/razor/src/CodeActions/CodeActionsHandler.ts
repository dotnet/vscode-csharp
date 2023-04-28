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

export class CodeActionsHandler {
    private static readonly provideCodeActionsEndpoint = 'razor/provideCodeActions';
    private static readonly resolveCodeActionsEndpoint = 'razor/resolveCodeActions';
    private codeActionRequestType: RequestType<SerializableDelegatedCodeActionParams, CodeAction[], any> = new RequestType(CodeActionsHandler.provideCodeActionsEndpoint);
    private codeActionResolveRequestType: RequestType<SerializableRazorResolveCodeActionParams, CodeAction, any> = new RequestType(CodeActionsHandler.resolveCodeActionsEndpoint);
    private emptyCodeActionResponse: CodeAction[] = [];

    constructor(
        private readonly documentManager: RazorDocumentManager,
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger) { }

    public register() {
        // tslint:disable-next-line: no-floating-promises
        this.serverClient.onRequestWithParams<SerializableDelegatedCodeActionParams, CodeAction[], any>(
            this.codeActionRequestType,
            async (request: SerializableDelegatedCodeActionParams, token: vscode.CancellationToken) => this.provideCodeActions(request));

        // tslint:disable-next-line: no-floating-promises
        this.serverClient.onRequestWithParams<SerializableRazorResolveCodeActionParams, CodeAction, any>(
            this.codeActionResolveRequestType,
            async (request: SerializableRazorResolveCodeActionParams, token: vscode.CancellationToken) => this.resolveCodeAction(request));
    }

    private async provideCodeActions(delegatedCodeActionParams: SerializableDelegatedCodeActionParams) {
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

            // Point this request to the virtual C# document, and call Roslyn
            const virtualCSharpUri = UriConverter.serialize(razorDocument.csharpDocument.uri);
            codeActionParams.textDocument = TextDocumentIdentifier.create(virtualCSharpUri);

            return <CodeAction[]>await vscode.commands.executeCommand(RoslynLanguageServer.provideCodeActionsCommand, codeActionParams);
        } catch (error) {
            this.logger.logWarning(`${CodeActionsHandler.provideCodeActionsEndpoint} failed with ${error}`);
        }

        return this.emptyCodeActionResponse;
    }

    private async resolveCodeAction(resolveCodeActionParams: SerializableRazorResolveCodeActionParams) {
        try {
            const codeAction = resolveCodeActionParams.codeAction;
            const razorDocument = await this.documentManager.getDocument(resolveCodeActionParams.uri);
            if (razorDocument === undefined) {
                return <CodeAction>{};
            }

            // We only support C# delegated code actions (for now??)
            if (resolveCodeActionParams.languageKind !== LanguageKind.CSharp) {
                return <CodeAction>{};
            }

            // Call Roslyn. Since this code action came from Roslyn, we don't even have to point it
            // to the virtual C# document.
            return <CodeAction>await vscode.commands.executeCommand(RoslynLanguageServer.resolveCodeActionCommand, codeAction);
        } catch (error) {
            this.logger.logWarning(`${CodeActionsHandler.resolveCodeActionsEndpoint} failed with ${error}`);
        }

        return <CodeAction>{};
    }
}

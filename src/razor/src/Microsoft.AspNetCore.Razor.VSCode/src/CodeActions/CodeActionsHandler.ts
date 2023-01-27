/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-languageclient';
import { RazorDocumentManager } from '../Document/RazorDocumentManager';
import { RazorLanguageServerClient } from '../RazorLanguageServerClient';
import { RazorLogger } from '../RazorLogger';
import { convertRangeFromSerializable } from '../RPC/SerializableRange';
import { RazorCodeAction } from './RazorCodeAction';
import { SerializableDelegatedCodeActionParams } from './SerializableDelegatedCodeActionParams';

export class CodeActionsHandler {
    private static readonly provideCodeActionsEndpoint = 'razor/provideCodeActions';
    private codeActionRequestType: RequestType<SerializableDelegatedCodeActionParams, RazorCodeAction[], any> = new RequestType(CodeActionsHandler.provideCodeActionsEndpoint);
    private emptyCodeActionResponse: RazorCodeAction[] = [];

    constructor(
        private readonly documentManager: RazorDocumentManager,
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger) { }

    public register() {
        // tslint:disable-next-line: no-floating-promises
        this.serverClient.onRequestWithParams<SerializableDelegatedCodeActionParams, RazorCodeAction[], any>(
            this.codeActionRequestType,
            async (request, token) => this.provideCodeActions(request, token));
    }

    private async provideCodeActions(
        delegatedCodeActionParams: SerializableDelegatedCodeActionParams,
        cancellationToken: vscode.CancellationToken) {
        try {
            const codeActionParams = delegatedCodeActionParams.codeActionParams;
            const razorDocumentUri = vscode.Uri.parse(codeActionParams.textDocument.uri, true);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                return this.emptyCodeActionResponse;
            }

            const virtualCSharpUri = razorDocument.csharpDocument.uri;

            const range = convertRangeFromSerializable(codeActionParams.range);

            const commands = await vscode.commands.executeCommand<vscode.Command[]>(
                'vscode.executeCodeActionProvider',
                virtualCSharpUri,
                range) as vscode.Command[];

            if (commands.length === 0) {
                return this.emptyCodeActionResponse;
            }

            return commands.map(c => this.commandAsCodeAction(c));
        } catch (error) {
            this.logger.logWarning(`${CodeActionsHandler.provideCodeActionsEndpoint} failed with ${error}`);
        }

        return this.emptyCodeActionResponse;
    }

    private commandAsCodeAction(command: vscode.Command): RazorCodeAction {
        return { title: command.title, data: { CustomTags: [ 'CodeActionFromVSCode' ] } } as RazorCodeAction;
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ContextProviderApiV1, ResolveRequest, SupportedContextItem } from '@github/copilot-language-server';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageserver-protocol';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { CSharpExtensionId } from '../../constants/csharpExtensionId';

export interface DocumentContext {
    textDocument: lsp.TextDocumentIdentifier;
    position: lsp.Position;
}

export interface ContextResolveParam {
    documentContext: DocumentContext;
    completionId: string;
    timeBudget: number;
    data?: any;
}

const resolveContextRequest = new lsp.RequestType<ContextResolveParam, SupportedContextItem[], void>(
    'roslyn/resolveContext',
    lsp.ParameterStructures.auto
);

interface CopilotApi {
    getContextProviderAPI(version: string): Promise<ContextProviderApiV1 | undefined>;
}

function createContextResolveParam(request: ResolveRequest): ContextResolveParam | undefined {
    let document: vscode.TextDocument | undefined;
    if (vscode.window.activeTextEditor?.document.uri.toString() === request.documentContext.uri) {
        document = vscode.window.activeTextEditor.document;
    } else {
        document = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === request.documentContext.uri);
    }
    if (document === undefined) {
        return undefined;
    }

    const position = document.positionAt(request.documentContext.offset);
    const uri = vscode.Uri.parse(request.documentContext.uri);
    const textDocument = lsp.TextDocumentIdentifier.create(uri.fsPath);

    const contextResolveParam: ContextResolveParam = {
        documentContext: {
            textDocument: textDocument,
            position: position,
        },
        completionId: request.completionId,
        timeBudget: request.timeBudget,
    };
    return contextResolveParam;
}

export async function registerCopilotContextProviders(
    copilotExt: CopilotApi | undefined,
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    channel: vscode.LogOutputChannel
) {
    const contextProviderApi = await copilotExt?.getContextProviderAPI('v1');

    if (!contextProviderApi) {
        channel.debug('Incompatible GitHub Copilot extension installed. Skip registeration of C# context providers.');
        return;
    }

    context.subscriptions.push(
        contextProviderApi.registerContextProvider<SupportedContextItem>({
            id: CSharpExtensionId, // use extension id as provider id for now
            selector: [{ language: 'csharp' }],
            resolver: {
                resolve: async (request, token) => {
                    const contextResolveParam = createContextResolveParam(request);
                    if (!contextResolveParam) {
                        return [];
                    }
                    const traits = await languageServer.sendRequest(resolveContextRequest, contextResolveParam, token);
                    return traits;
                },
            },
        })
    );

    channel.debug('Registration of C# context provider for GitHub Copilot extension succeeded.');
}

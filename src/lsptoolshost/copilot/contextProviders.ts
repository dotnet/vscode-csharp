/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ContextProviderApiV1, ResolveRequest, SupportedContextItem } from '@github/copilot-language-server';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageserver-protocol';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { CSharpExtensionId } from '../../constants/csharpExtensionId';
import { getCSharpDevKit } from '../../utils/getCSharpDevKit';

type ActiveExperiments = { [name: string]: string | number | boolean | string[] };

export interface DocumentContext {
    textDocument: lsp.TextDocumentIdentifier;
    position: lsp.Position;
}

export interface ContextResolveParam {
    documentContext: DocumentContext;
    completionId: string;
    timeBudget: number;
    data?: any;
    activeExperiments: ActiveExperiments;
}
const resolveContextMethodName = 'roslyn/resolveContext@2';
const resolveContextRequest = new lsp.RequestType<ContextResolveParam, SupportedContextItem[], void>(
    resolveContextMethodName,
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
        data: request.data,
        activeExperiments: Object.fromEntries(request.activeExperiments),
    };
    return contextResolveParam;
}

export function registerCopilotContextProviders(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    channel: vscode.LogOutputChannel
) {
    const devkit = getCSharpDevKit();
    if (!devkit) {
        return;
    }

    devkit.activate().then(async () => {
        try {
            const copilotApi = vscode.extensions.getExtension<CopilotApi>('github.copilot');
            if (!copilotApi) {
                channel.debug(
                    'Failed to find compatible version of GitHub Copilot extension installed. Skip registeration of Copilot context provider.'
                );
                return;
            }

            const api = await copilotApi.activate();
            const contextProviderApi = await api.getContextProviderAPI('v1');

            if (!contextProviderApi) {
                channel.debug(
                    'Incompatible GitHub Copilot extension installed. Skip registeration of C# context providers.'
                );
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
                            const items = await languageServer.sendRequest(
                                resolveContextRequest,
                                contextResolveParam,
                                token
                            );
                            channel.trace(`Copilot context provider resolved ${items.length} items`);
                            return items;
                        },
                    },
                })
            );

            channel.debug('Registration of C# context provider for GitHub Copilot extension succeeded.');
        } catch (error) {
            channel.error('Failed to register Copilot context providers', error);
        }
    });
}

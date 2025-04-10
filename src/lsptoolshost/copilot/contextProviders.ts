/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ContextProviderApiV1, ResolveRequest, SupportedContextItem } from '@github/copilot-language-server';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageserver-protocol';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { CSharpExtensionId } from '../../constants/csharpExtensionId';
import { csharpDevkitExtensionId, getCSharpDevKit } from '../../utils/getCSharpDevKit';
import path from 'path';
import { readJsonSync } from 'fs-extra';

export const copilotLanguageServerExtensionComponentName = '@microsoft/visualstudio.copilot.roslyn.languageserver';
export const copilotLanguageServerExtensionAssemblyName = 'Microsoft.VisualStudio.Copilot.Roslyn.LanguageServer.dll';
const copilotLanguageServerExtensionCapabilitiesFileName = 'capabilities.json';

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

const oldResolveContextMethodName = 'roslyn/resolveContext';
const oldresolveContextMethodSupportedVersion = '1';
const newResolveContextMethodName = 'roslyn/resolveContext@2';
const newResolveContextMethodSupportedVersion = '1';
const oldResolveContextRequest = new lsp.RequestType<ContextResolveParam, SupportedContextItem[], void>(
    oldResolveContextMethodName,
    lsp.ParameterStructures.auto
);
const newResolveContextRequest = new lsp.RequestType<ContextResolveParam, SupportedContextItem[], void>(
    newResolveContextMethodName,
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

    devkit.activate().then(async (devKitExports) => {
        try {
            let resolveMethod: lsp.RequestType<ContextResolveParam, SupportedContextItem[], void> | undefined =
                undefined;
            const copilotServerExtensionfolder = devKitExports.components[copilotLanguageServerExtensionComponentName];
            if (copilotServerExtensionfolder) {
                const capabilitiesFilePath = path.join(
                    copilotServerExtensionfolder,
                    copilotLanguageServerExtensionCapabilitiesFileName
                );
                const capabilitiesContent = await readJsonSync(capabilitiesFilePath);
                for (const capability of capabilitiesContent?.capabilities ?? []) {
                    if (
                        capability.method === oldResolveContextMethodName &&
                        capability.version === oldresolveContextMethodSupportedVersion
                    ) {
                        resolveMethod = oldResolveContextRequest;
                        channel.debug(`supported 'roslyn/resolveContext' method found in capabilities.json`);
                        break;
                    } else if (
                        capability.method === newResolveContextMethodName &&
                        capability.version === newResolveContextMethodSupportedVersion
                    ) {
                        resolveMethod = newResolveContextRequest;
                        channel.debug(`supported 'roslyn/resolveContext@2' method found in capabilities.json`);
                        break;
                    }
                }
            }

            if (!resolveMethod) {
                channel.debug(
                    `Failed to find compatible version of context provider from installed version of ${csharpDevkitExtensionId}.`
                );
                return;
            }

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
                            const items = await languageServer.sendRequest(resolveMethod, contextResolveParam, token);
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

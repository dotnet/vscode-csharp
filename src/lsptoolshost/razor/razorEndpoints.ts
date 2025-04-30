/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import {
    ColorInformation,
    ColorPresentationParams,
    ColorPresentationRequest,
    CompletionList,
    CompletionParams,
    CompletionRequest,
    DocumentColorParams,
    DocumentColorRequest,
    DocumentHighlight,
    DocumentHighlightKind,
    DocumentHighlightParams,
    DocumentHighlightRequest,
    FoldingRange,
    FoldingRangeParams,
    FoldingRangeRequest,
    Hover,
    HoverParams,
    HoverRequest,
    LogMessageParams,
    MarkupKind,
    NotificationType,
    RequestType,
} from 'vscode-languageclient';
import { RazorLogger } from '../../razor/src/razorLogger';
import { HtmlUpdateParameters } from './htmlUpdateParameters';
import { UriConverter } from '../utils/uriConverter';
import { PlatformInformation } from '../../shared/platform';
import { HtmlDocumentManager } from './htmlDocumentManager';
import { DocumentColorHandler } from '../../razor/src/documentColor/documentColorHandler';
import { razorOptions } from '../../shared/options';
import { ColorPresentationHandler } from '../../razor/src/colorPresentation/colorPresentationHandler';
import { ColorPresentation } from 'vscode-html-languageservice';
import { convertRangeToSerializable } from '../../razor/src/rpc/serializableRange';
import { FoldingRangeHandler } from '../../razor/src/folding/foldingRangeHandler';
import { CompletionHandler } from '../../razor/src/completion/completionHandler';
import { DynamicFileInfoHandler } from '../../razor/src/dynamicFile/dynamicFileInfoHandler';
import { ProvideDynamicFileParams } from '../../razor/src/dynamicFile/provideDynamicFileParams';
import { ProvideDynamicFileResponse } from '../../razor/src/dynamicFile/provideDynamicFileResponse';
import { RazorMapSpansParams } from '../../razor/src/mapping/razorMapSpansParams';
import { RazorMapSpansResponse } from '../../razor/src/mapping/razorMapSpansResponse';
import { MappingHandler } from '../../razor/src/mapping/mappingHandler';
import { RazorMapTextChangesParams } from '../../razor/src/mapping/razorMapTextChangesParams';
import { RazorMapTextChangesResponse } from '../../razor/src/mapping/razorMapTextChangesResponse';

export function registerRazorEndpoints(
    context: vscode.ExtensionContext,
    roslynLanguageServer: RoslynLanguageServer,
    razorLogger: RazorLogger,
    platformInfo: PlatformInformation
) {
    const logNotificationType = new NotificationType<LogMessageParams>('razor/log');
    roslynLanguageServer.registerOnNotificationWithParams(logNotificationType, (params) =>
        razorLogger.log(params.message, params.type)
    );

    if (razorOptions.cohostingEnabled) {
        registerCohostingEndpoints();
    } else {
        registerNonCohostingEndpoints();
    }

    return;

    //
    // Local Functions
    //
    function registerCohostingEndpoints() {
        const documentManager = new HtmlDocumentManager(platformInfo, razorLogger);
        context.subscriptions.push(documentManager.register());

        registerRequestHandler<HtmlUpdateParameters, void>('razor/updateHtml', async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            await documentManager.updateDocumentText(uri, params.text);
        });

        registerRequestHandler<DocumentColorParams, ColorInformation[]>(DocumentColorRequest.method, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            return await DocumentColorHandler.doDocumentColorRequest(document.uri);
        });

        registerRequestHandler<ColorPresentationParams, ColorPresentation[]>(
            ColorPresentationRequest.method,
            async (params) => {
                const uri = UriConverter.deserialize(params.textDocument.uri);
                const document = await documentManager.getDocument(uri);

                return await ColorPresentationHandler.doColorPresentationRequest(document.uri, params);
            }
        );

        registerRequestHandler<FoldingRangeParams, FoldingRange[]>(FoldingRangeRequest.method, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            const results = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
                'vscode.executeFoldingRangeProvider',
                document.uri
            );

            return FoldingRangeHandler.convertFoldingRanges(results, razorLogger);
        });

        registerRequestHandler<HoverParams, Hover | undefined>(HoverRequest.method, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            const results = await vscode.commands.executeCommand<vscode.Hover[]>(
                'vscode.executeHoverProvider',
                document.uri,
                params.position
            );
            const applicableHover = results.filter((item) => item.range)[0];

            return rewriteHover(applicableHover);
        });

        registerRequestHandler<DocumentHighlightParams, DocumentHighlight[]>(
            DocumentHighlightRequest.method,
            async (params) => {
                const uri = UriConverter.deserialize(params.textDocument.uri);
                const document = await documentManager.getDocument(uri);

                const results = await vscode.commands.executeCommand<vscode.DocumentHighlight[]>(
                    'vscode.executeDocumentHighlights',
                    document.uri,
                    params.position
                );

                return rewriteHighlight(results);
            }
        );

        registerRequestHandler<CompletionParams, CompletionList>(CompletionRequest.method, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            return CompletionHandler.provideVscodeCompletions(
                document.uri,
                params.position,
                params.context?.triggerCharacter
            );
        });
    }

    function registerNonCohostingEndpoints() {
        registerRequestHandler<ProvideDynamicFileParams, ProvideDynamicFileResponse>(
            'razor/provideDynamicFileInfo',
            async (params) =>
                vscode.commands.executeCommand(DynamicFileInfoHandler.provideDynamicFileInfoCommand, params)
        );

        registerRequestHandler<ProvideDynamicFileParams, ProvideDynamicFileResponse>(
            'razor/removeDynamicFileInfo',
            async (params) =>
                vscode.commands.executeCommand(DynamicFileInfoHandler.provideDynamicFileInfoCommand, params)
        );
        registerRequestHandler<RazorMapSpansParams, RazorMapSpansResponse>('razor/mapSpans', async (params) => {
            return await vscode.commands.executeCommand<RazorMapSpansResponse>(MappingHandler.MapSpansCommand, params);
        });
        registerRequestHandler<RazorMapTextChangesParams, RazorMapTextChangesResponse>(
            'razor/mapTextChanges',
            async (params) => {
                return await vscode.commands.executeCommand<RazorMapTextChangesResponse>(
                    MappingHandler.MapChangesCommand,
                    params
                );
            }
        );
    }

    // Helper method that registers a request handler, and logs errors to the Razor logger.
    function registerRequestHandler<Params, Result>(method: string, invocation: (params: Params) => Promise<Result>) {
        const requestType = new RequestType<Params, Result, Error>(method);
        roslynLanguageServer.registerOnRequest(requestType, async (params) => {
            try {
                return await invocation(params);
            } catch (error) {
                razorLogger.logError(`Error: ${error}`, error);
                return undefined;
            }
        });
    }
}

function rewriteHover(hover: vscode.Hover): Hover | undefined {
    if (!hover) {
        return undefined;
    }

    const markdownString = new vscode.MarkdownString();
    for (const content of hover.contents) {
        if ((content as { language: string; value: string }).language) {
            const contentObject = content as { language: string; value: string };
            markdownString.appendCodeblock(contentObject.value, contentObject.language);
        } else {
            const contentValue = (content as vscode.MarkdownString).value;
            markdownString.appendMarkdown(contentValue);
        }
    }

    return {
        contents: { kind: MarkupKind.Markdown, value: markdownString.value },
        range: hover.range ? convertRangeToSerializable(hover.range) : undefined,
    };
}

function rewriteHighlight(highlights: vscode.DocumentHighlight[]): DocumentHighlight[] {
    return highlights.map((highlight) => {
        return {
            range: convertRangeToSerializable(highlight.range),
            kind: convertHighlightKind(highlight.kind),
        };
    });
}

function convertHighlightKind(kind: vscode.DocumentHighlightKind | undefined): DocumentHighlightKind | undefined {
    switch (kind) {
        case vscode.DocumentHighlightKind.Text:
            return DocumentHighlightKind.Text;
        case vscode.DocumentHighlightKind.Read:
            return DocumentHighlightKind.Read;
        case vscode.DocumentHighlightKind.Write:
            return DocumentHighlightKind.Write;
        default:
            return undefined;
    }
}

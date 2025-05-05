/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import {
    ColorPresentationRequest,
    CompletionRequest,
    DefinitionRequest,
    DocumentColorRequest,
    DocumentFormattingRequest,
    DocumentHighlight,
    DocumentHighlightKind,
    DocumentHighlightRequest,
    DocumentOnTypeFormattingRequest,
    FoldingRangeRequest,
    Hover,
    HoverRequest,
    ImplementationRequest,
    Location,
    LogMessageParams,
    MarkupKind,
    MarkupContent,
    NotificationType,
    ReferencesRequest,
    RequestType,
    SignatureHelp,
    SignatureHelpRequest,
} from 'vscode-languageclient';
import { RazorLogger } from '../../razor/src/razorLogger';
import { HtmlUpdateParameters } from './htmlUpdateParameters';
import { UriConverter } from '../utils/uriConverter';
import { PlatformInformation } from '../../shared/platform';
import { HtmlDocumentManager } from './htmlDocumentManager';
import { DocumentColorHandler } from '../../razor/src/documentColor/documentColorHandler';
import { razorOptions } from '../../shared/options';
import { ColorPresentationHandler } from '../../razor/src/colorPresentation/colorPresentationHandler';
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
import { FormattingHandler } from '../../razor/src/formatting/formattingHandler';

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

        registerMethodHandler<HtmlUpdateParameters, void>('razor/updateHtml', async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            await documentManager.updateDocumentText(uri, params.text);
        });

        registerRequestHandler(DocumentColorRequest.type, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            return await DocumentColorHandler.doDocumentColorRequest(document.uri);
        });

        registerRequestHandler(ColorPresentationRequest.type, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            return await ColorPresentationHandler.doColorPresentationRequest(document.uri, params);
        });

        registerRequestHandler(FoldingRangeRequest.type, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            const results = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
                'vscode.executeFoldingRangeProvider',
                document.uri
            );

            return FoldingRangeHandler.convertFoldingRanges(results, razorLogger);
        });

        registerRequestHandler(HoverRequest.type, async (params) => {
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

        registerRequestHandler(DocumentHighlightRequest.type, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            const results = await vscode.commands.executeCommand<vscode.DocumentHighlight[]>(
                'vscode.executeDocumentHighlights',
                document.uri,
                params.position
            );

            return rewriteHighlight(results);
        });

        registerRequestHandler(CompletionRequest.type, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            return CompletionHandler.provideVscodeCompletions(
                document.uri,
                params.position,
                params.context?.triggerCharacter
            );
        });

        registerRequestHandler(ReferencesRequest.type, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            const results = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider',
                document.uri,
                params.position
            );

            return rewriteLocations(results);
        });

        registerRequestHandler(ImplementationRequest.type, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            const results = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeImplementationProvider',
                document.uri,
                params.position
            );

            return rewriteLocations(results);
        });

        registerRequestHandler(DefinitionRequest.type, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            const results = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                document.uri,
                params.position
            );

            return rewriteLocations(results);
        });

        registerRequestHandler(SignatureHelpRequest.type, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            const results = await vscode.commands.executeCommand<vscode.SignatureHelp>(
                'vscode.executeSignatureHelpProvider',
                document.uri,
                params.position
            );

            if (!results) {
                return undefined;
            }

            return rewriteSignatureHelp(results);
        });

        registerRequestHandler(DocumentFormattingRequest.type, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            const content = document.getContent();
            const options = <vscode.FormattingOptions>params.options;

            const response = await FormattingHandler.getHtmlFormattingResult(document.uri, content, options);
            return response?.edits;
        });

        registerRequestHandler(DocumentOnTypeFormattingRequest.type, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri);

            const content = document.getContent();
            const options = <vscode.FormattingOptions>params.options;

            const response = await FormattingHandler.getHtmlOnTypeFormattingResult(
                document.uri,
                content,
                params.position,
                params.ch,
                options
            );
            return response?.edits;
        });
    }

    function registerNonCohostingEndpoints() {
        registerMethodHandler<ProvideDynamicFileParams, ProvideDynamicFileResponse>(
            'razor/provideDynamicFileInfo',
            async (params) =>
                vscode.commands.executeCommand(DynamicFileInfoHandler.provideDynamicFileInfoCommand, params)
        );

        registerMethodHandler<ProvideDynamicFileParams, ProvideDynamicFileResponse>(
            'razor/removeDynamicFileInfo',
            async (params) =>
                vscode.commands.executeCommand(DynamicFileInfoHandler.provideDynamicFileInfoCommand, params)
        );
        registerMethodHandler<RazorMapSpansParams, RazorMapSpansResponse>('razor/mapSpans', async (params) => {
            return await vscode.commands.executeCommand<RazorMapSpansResponse>(MappingHandler.MapSpansCommand, params);
        });
        registerMethodHandler<RazorMapTextChangesParams, RazorMapTextChangesResponse>(
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
    function registerRequestHandler<Params, Result, Error>(
        type: RequestType<Params, Result, Error>,
        invocation: (params: Params) => Promise<Result>
    ) {
        return registerMethodHandler<Params, Result>(type.method, invocation);
    }

    function registerMethodHandler<Params, Result>(method: string, invocation: (params: Params) => Promise<Result>) {
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

function rewriteLocations(locations: vscode.Location[]): Location[] {
    return locations.map((location) => {
        return {
            uri: UriConverter.serialize(location.uri),
            range: convertRangeToSerializable(location.range),
        };
    });
}

function rewriteSignatureHelp(signatureHelp: vscode.SignatureHelp): SignatureHelp {
    return {
        activeParameter: signatureHelp.activeParameter ?? undefined,
        activeSignature: signatureHelp.activeSignature ?? undefined,
        signatures: signatureHelp.signatures.map((signature) => {
            return {
                label: signature.label,
                documentation: rewriteMarkdownString(signature.documentation),
                parameters: signature.parameters.map((parameter) => {
                    return {
                        label: parameter.label,
                        documentation: rewriteMarkdownString(parameter.documentation),
                    };
                }),
            };
        }),
    };
}

function rewriteMarkdownString(documentation: string | vscode.MarkdownString | undefined): MarkupContent | undefined {
    if (!documentation) {
        return undefined;
    }

    if ((documentation as vscode.MarkdownString).value) {
        const markdownString = documentation as vscode.MarkdownString;
        return {
            kind: MarkupKind.Markdown,
            value: markdownString.value,
        };
    }

    return { kind: MarkupKind.PlainText, value: <string>documentation };
}

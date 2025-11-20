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
import { ColorPresentationHandler } from '../../razor/src/colorPresentation/colorPresentationHandler';
import { convertRangeToSerializable } from '../../razor/src/rpc/serializableRange';
import { FoldingRangeHandler } from '../../razor/src/folding/foldingRangeHandler';
import { CompletionHandler } from '../../razor/src/completion/completionHandler';
import { FormattingHandler } from '../../razor/src/formatting/formattingHandler';
import { ReportIssueCommand } from '../../razor/src/diagnostics/reportIssueCommand';
import { HtmlDocument } from './htmlDocument';
import { HtmlForwardedRequest } from './htmlForwardedRequest';
import { BlazorDebugConfigurationProvider } from '../../razor/src/blazorDebug/blazorDebugConfigurationProvider';
import { ShowGeneratedDocumentCommand } from './showGeneratedDocumentCommand';
import { RazorLanguageConfiguration } from '../../razor/src/razorLanguageConfiguration';

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

    registerCohostingEndpoints();

    context.subscriptions.push(BlazorDebugConfigurationProvider.register(razorLogger, vscode));
    context.subscriptions.push(ShowGeneratedDocumentCommand.register(roslynLanguageServer));

    const languageConfiguration = new RazorLanguageConfiguration();
    context.subscriptions.push(languageConfiguration.register());

    return;

    //
    // Local Functions
    //
    function registerCohostingEndpoints() {
        const documentManager = new HtmlDocumentManager(platformInfo, roslynLanguageServer, razorLogger);
        const reportIssueCommand = new ReportIssueCommand(vscode, documentManager, roslynLanguageServer, razorLogger);
        context.subscriptions.push(documentManager.register());
        context.subscriptions.push(reportIssueCommand.register());

        registerMethodHandler<HtmlUpdateParameters, void>('razor/updateHtml', async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            await documentManager.updateDocumentText(uri, params.checksum, params.text);
        });

        registerCohostHandler(DocumentColorRequest.type, documentManager, async (document) => {
            return await DocumentColorHandler.doDocumentColorRequest(document.uri);
        });

        registerCohostHandler(ColorPresentationRequest.type, documentManager, async (document, params) => {
            return await ColorPresentationHandler.doColorPresentationRequest(document.uri, params);
        });

        registerCohostHandler(FoldingRangeRequest.type, documentManager, async (document) => {
            const results = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
                'vscode.executeFoldingRangeProvider',
                document.uri
            );

            return FoldingRangeHandler.convertFoldingRanges(results, razorLogger);
        });

        registerCohostHandler(HoverRequest.type, documentManager, async (document, params) => {
            const results = await vscode.commands.executeCommand<vscode.Hover[]>(
                'vscode.executeHoverProvider',
                document.uri,
                params.position
            );
            const applicableHover = results.filter((item) => item.range)[0];

            return rewriteHover(applicableHover);
        });

        registerCohostHandler(DocumentHighlightRequest.type, documentManager, async (document, params) => {
            const results = await vscode.commands.executeCommand<vscode.DocumentHighlight[]>(
                'vscode.executeDocumentHighlights',
                document.uri,
                params.position
            );

            return rewriteHighlight(results);
        });

        registerCohostHandler(CompletionRequest.type, documentManager, async (document, params) => {
            return CompletionHandler.provideVscodeCompletions(
                document.uri,
                params.position,
                params.context?.triggerCharacter
            );
        });

        registerCohostHandler(ReferencesRequest.type, documentManager, async (document, params) => {
            const results = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider',
                document.uri,
                params.position
            );

            return rewriteLocations(results);
        });

        registerCohostHandler(ImplementationRequest.type, documentManager, async (document, params) => {
            const results = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeImplementationProvider',
                document.uri,
                params.position
            );

            return rewriteLocations(results);
        });

        registerCohostHandler(DefinitionRequest.type, documentManager, async (document, params) => {
            const results = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                document.uri,
                params.position
            );

            return rewriteLocations(results);
        });

        registerCohostHandler(SignatureHelpRequest.type, documentManager, async (document, params) => {
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

        registerCohostHandler(DocumentFormattingRequest.type, documentManager, async (document, params) => {
            const content = document.getContent();
            const options = <vscode.FormattingOptions>params.options;

            const response = await FormattingHandler.getHtmlFormattingResult(document.uri, content, options);
            return response?.edits;
        });

        registerCohostHandler(DocumentOnTypeFormattingRequest.type, documentManager, async (document, params) => {
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

    // Helper method that registers a request handler, and logs errors to the Razor logger.
    function registerCohostHandler<Params, Result, Error>(
        type: RequestType<Params, Result, Error>,
        documentManager: HtmlDocumentManager,
        invocation: (document: HtmlDocument, request: Params) => Promise<Result>
    ) {
        return registerMethodHandler<HtmlForwardedRequest<Params>, Result | undefined>(type.method, async (params) => {
            const uri = UriConverter.deserialize(params.textDocument.uri);
            const document = await documentManager.getDocument(uri, params.checksum);

            if (!document) {
                return undefined;
            }

            return invocation(document, params.request);
        });
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

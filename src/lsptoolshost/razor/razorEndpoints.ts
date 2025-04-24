/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import * as vscode from 'vscode';
import {
    ColorInformation,
    ColorPresentationParams,
    ColorPresentationRequest,
    DocumentColorParams,
    DocumentColorRequest,
    LogMessageParams,
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

export function registerRazorEndpoints(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    razorLogger: RazorLogger,
    platformInfo: PlatformInformation
) {
    const logNotificationType = new NotificationType<LogMessageParams>('razor/log');
    languageServer.registerOnNotificationWithParams(logNotificationType, (params) =>
        razorLogger.log(params.message, params.type)
    );

    if (!razorOptions.cohostingEnabled) {
        return;
    }

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

    // Helper method that registers a request handler, and logs errors to the Razor logger.
    function registerRequestHandler<Params, Result>(method: string, invocation: (params: Params) => Promise<Result>) {
        const requestType = new RequestType<Params, Result, Error>(method);
        languageServer.registerOnRequest(requestType, async (params) => {
            try {
                return await invocation(params);
            } catch (error) {
                razorLogger.logError(`Error: ${error}`, error);
                return undefined;
            }
        });
    }
}

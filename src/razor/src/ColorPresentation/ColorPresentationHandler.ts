/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RequestType } from 'vscode-languageclient';
import { RazorDocumentManager } from '../Document/RazorDocumentManager';
import { RazorLanguageServerClient } from '../RazorLanguageServerClient';
import { RazorLogger } from '../RazorLogger';
import { convertTextEditToSerializable, SerializableTextEdit } from '../RPC/SerializableTextEdit';
import { ColorPresentationContext } from './ColorPresentationContext';
import { SerializableColorPresentation } from './SerializableColorPresentation';
import { SerializableColorPresentationParams } from './SerializableColorPresentationParams';

export class ColorPresentationHandler {
    private static readonly provideHtmlColorPresentation = 'razor/provideHtmlColorPresentation';
    private colorPresentationRequestType: RequestType<SerializableColorPresentationParams, SerializableColorPresentation[], any> =
        new RequestType(ColorPresentationHandler.provideHtmlColorPresentation);
    private emptyColorInformationResponse: SerializableColorPresentation[] = [];

    constructor(
        private readonly documentManager: RazorDocumentManager,
        private readonly serverClient: RazorLanguageServerClient,
        private readonly logger: RazorLogger) {
    }

    public register() {
        // tslint:disable-next-line: no-floating-promises
        this.serverClient.onRequestWithParams<SerializableColorPresentationParams, SerializableColorPresentation[], any>(
            this.colorPresentationRequestType,
            async (request: SerializableColorPresentationParams, token: vscode.CancellationToken) => this.provideHtmlColorPresentation(request, token));
    }

    private async provideHtmlColorPresentation(
        colorPresentationParams: SerializableColorPresentationParams,
        cancellationToken: vscode.CancellationToken) {
        try {
            const razorDocumentUri = vscode.Uri.parse(`${colorPresentationParams.textDocument.uri}`, true);
            const razorDocument = await this.documentManager.getDocument(razorDocumentUri);
            if (razorDocument === undefined) {
                this.logger.logWarning(`Could not find Razor document ${razorDocumentUri}; returning empty color information.`);
                return this.emptyColorInformationResponse;
            }

            const color = new vscode.Color(
                colorPresentationParams.color.red,
                colorPresentationParams.color.green,
                colorPresentationParams.color.blue,
                colorPresentationParams.color.alpha);
            const virtualHtmlUri = razorDocument.htmlDocument.uri;

            const colorPresentations = await vscode.commands.executeCommand<vscode.ColorPresentation[]>(
                'vscode.executeColorPresentationProvider',
                color,
                new ColorPresentationContext(virtualHtmlUri, colorPresentationParams.range));

            const serializableColorPresentations = this.SerializeColorPresentations(colorPresentations);
            return serializableColorPresentations;
        } catch (error) {
            this.logger.logWarning(`${ColorPresentationHandler.provideHtmlColorPresentation} failed with ${error}`);
        }

        return this.emptyColorInformationResponse;
    }

    private SerializeColorPresentations(colorPresentations: vscode.ColorPresentation[]) {
        const serializableColorPresentations = new Array<SerializableColorPresentation>();
        for (const colorPresentation of colorPresentations) {
            let serializedTextEdit: any = null;
            const serializableAdditionalTextEdits = new Array<SerializableTextEdit>();

            if (colorPresentation.textEdit) {
                serializedTextEdit = convertTextEditToSerializable(colorPresentation.textEdit);
            }

            if (colorPresentation.additionalTextEdits) {
                for (const additionalTextEdit of colorPresentation.additionalTextEdits) {
                    const serializableAdditionalTextEdit = convertTextEditToSerializable(additionalTextEdit);
                    serializableAdditionalTextEdits.push(serializableAdditionalTextEdit);
                }
            }

            const serializableColorPresentation = new SerializableColorPresentation(
                colorPresentation.label,
                serializedTextEdit,
                serializableAdditionalTextEdits);
            serializableColorPresentations.push(serializableColorPresentation);
        }

        return serializableColorPresentations;
    }
}

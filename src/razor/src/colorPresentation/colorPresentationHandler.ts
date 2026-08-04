/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { convertTextEditToSerializable, SerializableTextEdit } from '../rpc/serializableTextEdit';
import { ColorPresentationContext } from './colorPresentationContext';
import { SerializableColorPresentation } from './serializableColorPresentation';
import { SerializableColorPresentationParams } from './serializableColorPresentationParams';

export class ColorPresentationHandler {
    constructor() {}

    public static async doColorPresentationRequest(
        virtualHtmlUri: vscode.Uri,
        colorPresentationParams: SerializableColorPresentationParams
    ) {
        const color = new vscode.Color(
            colorPresentationParams.color.red,
            colorPresentationParams.color.green,
            colorPresentationParams.color.blue,
            colorPresentationParams.color.alpha
        );

        const colorPresentations = await vscode.commands.executeCommand<vscode.ColorPresentation[]>(
            'vscode.executeColorPresentationProvider',
            color,
            new ColorPresentationContext(virtualHtmlUri, colorPresentationParams.range)
        );

        const serializableColorPresentations = ColorPresentationHandler.SerializeColorPresentations(colorPresentations);
        return serializableColorPresentations;
    }

    private static SerializeColorPresentations(colorPresentations: vscode.ColorPresentation[]) {
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
                serializableAdditionalTextEdits
            );
            serializableColorPresentations.push(serializableColorPresentation);
        }

        return serializableColorPresentations;
    }
}

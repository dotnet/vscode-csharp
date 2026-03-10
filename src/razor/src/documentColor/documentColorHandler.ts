/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { convertRangeToSerializable } from '../rpc/serializableRange';
import { SerializableColorInformation } from './serializableColorInformation';

export class DocumentColorHandler {
    constructor() {}

    public static async doDocumentColorRequest(virtualHtmlUri: vscode.Uri) {
        const colorInformation = await vscode.commands.executeCommand<vscode.ColorInformation[]>(
            'vscode.executeDocumentColorProvider',
            virtualHtmlUri
        );

        const serializableColorInformation = new Array<SerializableColorInformation>();
        for (const color of colorInformation) {
            const serializableRange = convertRangeToSerializable(color.range);
            const serializableColor = new SerializableColorInformation(serializableRange, color.color);
            serializableColorInformation.push(serializableColor);
        }

        return serializableColorInformation;
    }
}

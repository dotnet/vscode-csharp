/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RazorLanguageServiceClient } from '../razorLanguageServiceClient';
import { RazorMapSpansParams } from './razorMapSpansParams';

export class MappingHandler {
    public static readonly MapSpansCommand = 'razor.mapSpansCommand';
    constructor(private readonly languageServiceClient: RazorLanguageServiceClient) {}

    public async register(): Promise<void> {
        vscode.commands.registerCommand(MappingHandler.MapSpansCommand, async (params: RazorMapSpansParams) => {
            return this.languageServiceClient.mapSpans(params);
        });
    }
}

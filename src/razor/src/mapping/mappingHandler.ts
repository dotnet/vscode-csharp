/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RazorLanguageServiceClient } from '../razorLanguageServiceClient';
import { RazorMapSpansParams } from './razorMapSpansParams';
import { RazorMapTextChangesParams } from './razorMapTextChangesParams';

export class MappingHandler {
    public static readonly MapSpansCommand = 'razor.mapSpansCommand';
    public static readonly MapChangesCommand = 'razor.mapChangesCommand';

    constructor(private readonly languageServiceClient: RazorLanguageServiceClient) {}

    public async register(): Promise<vscode.Disposable> {
        return vscode.Disposable.from(
            ...[
                vscode.commands.registerCommand(MappingHandler.MapSpansCommand, async (params: RazorMapSpansParams) => {
                    return this.languageServiceClient.mapSpans(params);
                }),
                vscode.commands.registerCommand(
                    MappingHandler.MapChangesCommand,
                    async (params: RazorMapTextChangesParams) => {
                        return this.languageServiceClient.mapTextChanges(params);
                    }
                ),
            ]
        );
    }
}

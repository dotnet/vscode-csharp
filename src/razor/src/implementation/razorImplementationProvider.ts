/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { RazorLanguageFeatureBase } from '../razorLanguageFeatureBase';
import { LanguageKind } from '../rpc/languageKind';
import { MappingHelpers } from '../mapping/mappingHelpers';
import { isRazorCSharpFile } from '../razorConventions';

export class RazorImplementationProvider
    extends RazorLanguageFeatureBase
    implements vscode.ImplementationProvider {

    public async provideImplementation(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken) {

        const projection = await this.getProjection(document, position, token);
        if (!projection ||
            projection.languageKind === LanguageKind.Html ||
            projection.languageKind === LanguageKind.Razor) {
            // We don't think that javascript implementations are supported by VSCodes HTML support.
            // Since we shim through to them we'll do nothing until we get an ask.
            return;
        }

        const implementations = await vscode.commands.executeCommand<vscode.Definition>(
            'vscode.executeImplementationProvider',
            projection.uri,
            projection.position) as vscode.Location[];
        
        const result = new Array<vscode.Location>();
        for (const implementation of implementations) {
            if (isRazorCSharpFile(implementation.uri)) {
                const remappedLocation = await MappingHelpers.remapGeneratedFileLocation(implementation, this.serviceClient, this.logger, token);
                if (remappedLocation === undefined) {
                    continue;
                }

                result.push(remappedLocation);
            } else {
                // This means it is a .cs file, so we don't need to remap.
                result.push(implementation);
            }
        }

        return result;
    }
}

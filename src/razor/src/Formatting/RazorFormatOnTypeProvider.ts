/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';

export class RazorFormatOnTypeProvider
    implements vscode.OnTypeFormattingEditProvider {

    public provideOnTypeFormattingEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        character: string,
        formattingOptions: vscode.FormattingOptions,
        cancellationToken: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        return new Array<vscode.TextEdit>();
    }
}
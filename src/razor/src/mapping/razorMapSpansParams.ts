/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Range, TextDocumentIdentifier } from 'vscode-languageserver-protocol';

// Matches https://github.com/dotnet/razor/blob/main/src/Razor/src/Microsoft.VisualStudioCode.RazorExtension/Services/RazorMapSpansParams.cs
export class RazorMapSpansParams {
    constructor(public readonly csharpDocument: TextDocumentIdentifier, public readonly ranges: Range[]) {}
}

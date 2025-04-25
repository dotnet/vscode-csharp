/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TextDocumentIdentifier } from 'vscode-languageserver-types';
import { razorTextChange } from '../dynamicFile/razorTextChange';

// Matches https://github.com/dotnet/razor/blob/401f6f8632a7e0320bc12804fa7e9659b3b3aeab/src/Razor/src/Microsoft.VisualStudioCode.RazorExtension/Services/RazorMapTextChangesParams.cs
export class RazorMapTextChangesParams {
    constructor(
        public readonly csharpDocument: TextDocumentIdentifier,
        public readonly textChanges: razorTextChange[]
    ) {}
}

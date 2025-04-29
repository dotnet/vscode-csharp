/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TextDocumentIdentifier } from 'vscode-languageserver-types';
import { razorTextChange } from '../dynamicFile/razorTextChange';

// Matches https://github.com/dotnet/razor/blob/401f6f8632a7e0320bc12804fa7e9659b3b3aeab/src/Razor/src/Microsoft.VisualStudioCode.RazorExtension/Services/RazorMapTextChangesResponse.cs
export class RazorMapTextChangesResponse {
    static empty: RazorMapTextChangesResponse | PromiseLike<RazorMapTextChangesResponse>;
    constructor(
        public readonly razorDocument: TextDocumentIdentifier,
        public readonly textChanges: razorTextChange[]
    ) {}
}

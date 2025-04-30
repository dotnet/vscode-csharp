/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextDocumentIdentifier } from 'vscode-languageserver-types';
import { razorTextSpan } from '../dynamicFile/razorTextSpan';
import { SerializableRange } from '../rpc/serializableRange';

// matches https://github.com/dotnet/razor/blob/main/src/Razor/src/Microsoft.VisualStudioCode.RazorExtension/Services/RazorMapSpansResponse.cs
export class RazorMapSpansResponse {
    static empty: RazorMapSpansResponse = new RazorMapSpansResponse([], [], { uri: '' });

    constructor(
        public readonly ranges: SerializableRange[],
        public readonly spans: razorTextSpan[],
        public readonly razorDocument: TextDocumentIdentifier
    ) {}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { razorTextChange } from '../dynamicFile/razorTextChange';

// Matches https://github.com/dotnet/razor/blob/401f6f8632a7e0320bc12804fa7e9659b3b3aeab/src/Razor/src/Microsoft.CodeAnalysis.Razor.Workspaces/Protocol/DocumentMapping/RazorMapToDocumentEditsResponse.cs
export class RazorMapToDocumentEditsResponse {
    constructor(public readonly textChanges: razorTextChange[], public readonly hostDocumentVersion: number) {}
}

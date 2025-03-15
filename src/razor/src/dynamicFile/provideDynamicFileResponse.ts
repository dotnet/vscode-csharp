/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextDocumentIdentifier } from 'vscode-languageserver-protocol';
import { ServerTextChange } from '../rpc/serverTextChange';

// matches https://github.com/dotnet/roslyn/blob/9e91ca6590450e66e0041ee3135bbf044ac0687a/src/LanguageServer/Microsoft.CodeAnalysis.LanguageServer/HostWorkspace/RazorDynamicFileInfoProvider.cs#L28
export class ProvideDynamicFileResponse {
    constructor(
        public readonly csharpDocument: TextDocumentIdentifier | null,
        public readonly updates: DynamicFileUpdate[] | null,
        public readonly checksum: string,
        public readonly checksumAlgorithm: number,
        public readonly encodingCodePage: number | null
    ) {}
}

export class DynamicFileUpdate {
    constructor(public readonly edits: ServerTextChange[]) {}
}

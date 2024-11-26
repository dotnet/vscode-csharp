/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextDocumentIdentifier } from 'vscode-languageclient/node';
import { ServerTextChange } from '../rpc/serverTextChange';

// matches https://github.com/dotnet/roslyn/blob/9e91ca6590450e66e0041ee3135bbf044ac0687a/src/LanguageServer/Microsoft.CodeAnalysis.LanguageServer/HostWorkspace/RazorDynamicFileInfoProvider.cs#L28
export class ProvideDynamicFileResponse {
    constructor(
        public readonly csharpDocument: TextDocumentIdentifier | null,
        public readonly edits: ServerTextChange[] | null
    ) {}
}

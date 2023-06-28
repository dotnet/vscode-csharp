/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CSharpProjectedDocumentContentProvider } from '../razor/src/csharp/csharpProjectedDocumentContentProvider';

export class UriConverter {
    public static serialize(uri: vscode.Uri): string {
        if (uri.scheme === CSharpProjectedDocumentContentProvider.scheme) {
            // VSCode specifically handles file schemes different than others:
            // https://github.com/microsoft/vscode-uri/blob/b54811339bd748982d0e2697fa857a3fecc72522/src/uri.ts#L606
            // Since it's desirable that  URIs follow the same scheme across different OSs regardless of
            // path separator, cause generation to happen as if it was a file scheme and then replace
            // with the actual scheme. This behavior follows the expectations in RazorDynamicFileInfoProvider.cs
            const fileSchemUri = uri.with({ scheme: 'file' });
            const uriString = fileSchemUri.toString(true);
            return uri.scheme + uriString.slice('file'.length);
        } else {
            // Fix issue in System.Uri where file:///c%3A/file.txt is not a valid Windows path
            return uri.toString(true);
        }
    }

    public static deserialize(value: string): vscode.Uri {
        return vscode.Uri.parse(value);
    }
}

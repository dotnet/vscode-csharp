/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

export class UriConverter {
    public static serialize(uri: vscode.Uri): string {
        if (uri.scheme === 'file') {
            // Fix issue in System.Uri where file:///c%3A/file.txt is not a valid Windows path
            return uri.toString(true);
        } else {
            let fileSchemUri = uri.with({scheme: 'file'});
            let uriString = fileSchemUri.toString(true);
            return uri.scheme + uriString.slice("file".length);
        }
    }

    public static deserialize(value: string): vscode.Uri {
        return vscode.Uri.parse(value);
    }
}

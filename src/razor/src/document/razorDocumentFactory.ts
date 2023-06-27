/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as vscode from 'vscode';
import { CSharpProjectedDocument } from '../csharp/csharpProjectedDocument';
import { CSharpProjectedDocumentContentProvider } from '../csharp/csharpProjectedDocumentContentProvider';
import { HtmlProjectedDocument } from '../html/htmlProjectedDocument';
import { HtmlProjectedDocumentContentProvider } from '../html/htmlProjectedDocumentContentProvider';
import { virtualCSharpSuffix, virtualHtmlSuffix } from '../razorConventions';
import { getUriPath } from '../uriPaths';
import { IRazorDocument } from './IRazorDocument';

export function createDocument(uri: vscode.Uri) {
    const csharpDocument = createProjectedCSharpDocument(uri);
    const htmlDocument = createProjectedHtmlDocument(uri);
    const path = getUriPath(uri);

    const document: IRazorDocument = {
        uri,
        path,
        csharpDocument,
        htmlDocument,
    };

    return document;
}

function createProjectedHtmlDocument(hostDocumentUri: vscode.Uri) {
    // Index.cshtml => Index.cshtml__virtual.html
    const path = getUriPath(hostDocumentUri);
    const projectedPath = `${path}${virtualHtmlSuffix}`;
    let uri = vscode.Uri.file(projectedPath);
    uri = uri.with({ scheme: HtmlProjectedDocumentContentProvider.scheme });
    const projectedDocument = new HtmlProjectedDocument(uri);

    return projectedDocument;
}

function createProjectedCSharpDocument(hostDocumentUri: vscode.Uri) {
    // Index.cshtml => Index.cshtml__virtual.cs
    const path = getUriPath(hostDocumentUri);
    const projectedPath = `${path}${virtualCSharpSuffix}`;
    let uri = vscode.Uri.file(projectedPath);
    uri = uri.with({ scheme: CSharpProjectedDocumentContentProvider.scheme });
    const projectedDocument = new CSharpProjectedDocument(uri);

    return projectedDocument;
}

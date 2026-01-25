/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Calculates the expected namespace for a C# file based on its location
 * relative to the project root.
 */
export function calculateNamespace(rootNamespace: string, csprojUri: vscode.Uri, fileUri: vscode.Uri): string {
    const csprojDir = path.dirname(csprojUri.fsPath);
    const fileDir = path.dirname(fileUri.fsPath);
    const relativePath = path.relative(csprojDir, fileDir);

    if (!relativePath || relativePath === '.') {
        return rootNamespace;
    }

    const suffix = relativePath
        .split(path.sep)
        .map((segment: string) => sanitizeFolderName(segment))
        .filter((segment: string) => segment.length > 0)
        .join('.');

    return suffix ? `${rootNamespace}.${suffix}` : rootNamespace;
}

/**
 * Sanitizes a folder name to be used as part of a namespace.
 * Removes or replaces characters that are invalid in C# namespaces.
 */
function sanitizeFolderName(name: string): string {
    return name
        .replace(/[\s-]/g, '_')
        .replace(/[^\w.]/g, '')
        .trim();
}

/**
 * Extracts the current namespace from C# file content.
 * Supports both traditional block namespaces and file-scoped namespaces.
 * Returns null if no namespace declaration is found.
 */
export function extractCurrentNamespace(
    content: string
): { namespace: string; isFileScoped: boolean; match: RegExpMatchArray } | null {

    // Try file-scoped namespace first (namespace Foo.Bar;)
    const fileScopedRegex = /^(\s*)namespace\s+([\w.]+)\s*;/m;
    let match = content.match(fileScopedRegex);

    if (match) {
        return {
            namespace: match[2],
            isFileScoped: true,
            match: match,
        };
    }

    // Try traditional block namespace (namespace Foo.Bar { ... })
    const blockNamespaceRegex = /^(\s*)namespace\s+([\w.]+)/m;
    match = content.match(blockNamespaceRegex);

    if (match) {
        return {
            namespace: match[2],
            isFileScoped: false,
            match: match,
        };
    }

    return null;
}

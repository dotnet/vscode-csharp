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
 * - Replaces whitespace, hyphens, and dots with underscores
 * - Prefixes segments starting with digits with underscore
 * - Removes any remaining invalid characters
 */
function sanitizeFolderName(name: string): string {
    // Normalize whitespace, hyphens, and dots to underscores
    // Dots are replaced to avoid creating unintended namespace segments
    let sanitized = name
        .replace(/[\s.-]/g, '_')
        .replace(/[^\w]/g, '')
        .trim();

    // C# namespace identifiers cannot start with a digit; prefix with '_' if they do
    if (/^[0-9]/.test(sanitized)) {
        sanitized = `_${sanitized}`;
    }

    return sanitized;
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Common directories to exclude when scanning for project files.
 */
const EXCLUDED_DIRECTORIES = [
    'bin',
    'obj',
    '.git',
    '.svn',
    '.hg',
    'node_modules',
    'packages',
    '.vs',
    '.vscode',
    'TestResults',
    'artifacts',
    '.idea',
    'wwwroot',
    'dist',
    'out',
    'build',
];

/**
 * Recursively finds all .csproj files in the given directory.
 * Excludes common build artifacts, version control directories, and dependencies.
 */
export async function getCsprojFiles(uri: vscode.Uri): Promise<vscode.Uri[]> {
    const results: vscode.Uri[] = [];

    try {
        const entries = await vscode.workspace.fs.readDirectory(uri);

        for (const [name, type] of entries) {
            // Skip build artifacts, version control, dependencies, and common irrelevant directories
            if (EXCLUDED_DIRECTORIES.includes(name) || name.startsWith('.')) {
                continue;
            }

            const fullPath = vscode.Uri.joinPath(uri, name);

            if (type === vscode.FileType.Directory) {
                results.push(...(await getCsprojFiles(fullPath)));
            } else if (name.endsWith('.csproj')) {
                results.push(fullPath);
            }
        }
    } catch (_err) {
        // Ignore permission errors or invalid directories
    }

    return results;
}

/**
 * Recursively finds all .cs files in the given directory.
 * Excludes common build output directories and other irrelevant directories.
 */
export async function getCsFiles(uri: vscode.Uri): Promise<vscode.Uri[]> {
    const results: vscode.Uri[] = [];

    try {
        const entries = await vscode.workspace.fs.readDirectory(uri);

        for (const [name, type] of entries) {
            // Skip build output directories, version control, dependencies, and common artifacts
            if (EXCLUDED_DIRECTORIES.includes(name) || name.startsWith('.')) {
                continue;
            }

            const fullPath = vscode.Uri.joinPath(uri, name);

            if (type === vscode.FileType.Directory) {
                results.push(...(await getCsFiles(fullPath)));
            } else if (name.endsWith('.cs')) {
                results.push(fullPath);
            }
        }
    } catch (_err) {
        // Ignore permission errors or invalid directories
    }

    return results;
}

/**
 * Extracts the root namespace from a .csproj file.
 * Falls back to the project file name if RootNamespace is not specified.
 */
export async function getRootNamespace(csprojUri: vscode.Uri): Promise<string> {
    try {
        const content = await vscode.workspace.fs.readFile(csprojUri);
        const text = Buffer.from(content).toString('utf8');

        const match = text.match(/<RootNamespace>(.*?)<\/RootNamespace>/);
        if (match) {
            return match[1].trim();
        }

        // Fall back to project file name without extension
        const fileName = path.basename(csprojUri.fsPath, '.csproj');
        return fileName;
    } catch (_err) {
        // If we can't read the file, use the filename as fallback
        return path.basename(csprojUri.fsPath, '.csproj');
    }
}

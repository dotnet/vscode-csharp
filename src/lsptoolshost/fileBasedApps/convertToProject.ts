/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export const convertToProjectCommandName = 'dotnet.convertToProject';

/**
 * Registers the command for converting a file-based C# app to a project-based app.
 *
 * This provides two entry points:
 * 1. Right-click on a C# file → "Convert to Project" → runs `dotnet project convert <file>`
 * 2. Command palette → "Convert C# File-based App to Project" → quick pick of discoverable
 *    file-based apps in the workspace, then runs conversion on the selected file.
 *
 * Requires .NET 10 SDK or later (the `dotnet project convert` command was introduced in .NET 10).
 */
export function registerConvertToProjectCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(convertToProjectCommandName, async (uri?: vscode.Uri): Promise<void> => {
            if (uri !== undefined) {
                // Invoked from the right-click context menu with a specific file.
                await convertToProject(uri);
            } else {
                // Invoked from the command palette — let the user pick from discoverable apps.
                await pickAndConvertToProject();
            }
        })
    );
}

/**
 * Converts the given file-based C# app to a project-based app by running
 * `dotnet project convert <file>` in an integrated terminal.
 */
async function convertToProject(uri: vscode.Uri): Promise<void> {
    // Use VS Code's language ID rather than the file extension, so that files VS Code
    // recognises as C# (e.g. via a language association override) are accepted regardless
    // of their extension.
    const document =
        vscode.workspace.textDocuments.find((d) => d.uri.fsPath === uri.fsPath) ??
        (await vscode.workspace.openTextDocument(uri));

    if (document.languageId !== 'csharp') {
        vscode.window.showErrorMessage(vscode.l10n.t('Only C# files can be converted to a project.'));
        return;
    }

    await runConvertCommand(uri.fsPath);
}

/**
 * Shows a quick-pick list of discoverable file-based C# apps in the workspace and
 * converts the one the user selects.
 *
 * A file is included in the list when any of the following is true:
 * 1. It starts with the `#!` shebang sequence (Roslyn automatic-discovery algorithm).
 * 2. It contains `#:` directives near the top (package/sdk/property directives).
 * 3. It is not in the directory cone of any `.csproj` file in the workspace, meaning it
 *    is a standalone C# file that is likely intended to be run as a file-based app.
 *
 * C# files are identified by VS Code's language ID (`csharp`) so that non-`.cs` files
 * that the user has associated with the C# language are also considered.
 *
 * TODO: Replace the client-side scan with an authoritative LSP request
 *       (e.g. `workspace/_ms_fileBasedProgramEntryPoints`) once the Roslyn language
 *       server exposes one.  The .NET 10 SDK (`dotnet project`) does not currently offer
 *       a CLI command to detect FBA entry points without converting or running them.
 */
async function pickAndConvertToProject(): Promise<void> {
    // Collect C# files from the workspace by extension, then augment with any already-open
    // documents that VS Code treats as C# even if they lack a .cs extension.
    const csFilesByExtension = await vscode.workspace.findFiles('**/*.cs', '**/obj/**');
    const csFileSet = new Set(csFilesByExtension.map((u) => u.fsPath));

    const allCsUris: vscode.Uri[] = [...csFilesByExtension];
    for (const doc of vscode.workspace.textDocuments) {
        if (doc.languageId === 'csharp' && !csFileSet.has(doc.uri.fsPath)) {
            allCsUris.push(doc.uri);
        }
    }

    if (allCsUris.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('No C# files found in the workspace.'));
        return;
    }

    // Build a set of directories that contain a .csproj so we can quickly check whether
    // a given .cs file lives inside a project cone.
    const csprojFiles = await vscode.workspace.findFiles('**/*.csproj', '**/obj/**');
    const csprojDirs = new Set(csprojFiles.map((u) => path.dirname(u.fsPath)));

    const entryPoints: vscode.QuickPickItem[] = [];

    for (const fileUri of allCsUris) {
        const filePath = fileUri.fsPath;
        const kind = detectFileBasedAppKind(filePath);

        let isEntryPoint = kind !== FileBasedAppKind.None;

        // Also include files that are not inside any .csproj directory cone even when
        // they lack explicit FBA markers, because such files have no project to belong
        // to and are likely intended as file-based programs.
        if (!isEntryPoint && !isInProjectCone(filePath, csprojDirs)) {
            isEntryPoint = true;
        }

        if (isEntryPoint) {
            const label = path.basename(filePath);
            const description = vscode.workspace.asRelativePath(fileUri, true);
            entryPoints.push({ label, description, detail: filePath });
        }
    }

    if (entryPoints.length === 0) {
        vscode.window.showInformationMessage(
            vscode.l10n.t(
                'No file-based C# apps were found in the workspace. ' +
                    'A file-based app entry point must contain a `#!` or `#:` directive, ' +
                    'or not be part of any `.csproj` project.'
            )
        );
        return;
    }

    const picked = await vscode.window.showQuickPick(entryPoints, {
        placeHolder: vscode.l10n.t('Select a file-based C# app to convert to a project'),
        matchOnDescription: true,
        matchOnDetail: true,
    });

    if (!picked?.detail) {
        return;
    }

    await runConvertCommand(picked.detail);
}

/**
 * Returns `true` when `filePath` resides inside the directory cone of at least one
 * `.csproj` file — i.e. when any directory in `csprojDirs` is an ancestor of (or the
 * same directory as) the file's parent directory.
 */
export function isInProjectCone(filePath: string, csprojDirs: Set<string>): boolean {
    let dir = path.dirname(filePath);
    let parent = path.dirname(dir);
    while (parent !== dir) {
        if (csprojDirs.has(dir)) {
            return true;
        }
        dir = parent;
        parent = path.dirname(dir);
    }
    // Check the final (root) directory.
    return csprojDirs.has(dir);
}

/**
 * Runs `dotnet project convert <filePath>` in an integrated terminal, targeting the
 * directory that contains the file so the SDK resolves paths correctly.
 */
async function runConvertCommand(filePath: string): Promise<void> {
    const workingDir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    // Reuse an existing terminal if one with our name already exists to keep the UI tidy.
    const terminalName = vscode.l10n.t('dotnet project convert');
    const existing = vscode.window.terminals.find((t) => t.name === terminalName);
    const terminal =
        existing ??
        vscode.window.createTerminal({
            name: terminalName,
            cwd: workingDir,
        });

    terminal.show(/*preserveFocus:*/ true);

    // Change to the file's directory first in case the terminal was reused with a different cwd.
    if (existing) {
        const cdCommand = process.platform === 'win32' ? `cd /d "${workingDir}"` : `cd "${workingDir}"`;
        terminal.sendText(cdCommand);
    }

    terminal.sendText(`dotnet project convert "${fileName}"`);
}

export enum FileBasedAppKind {
    /** The file is not a file-based app entry point. */
    None,
    /** The file starts with `#!`, making it a discoverable entry point. */
    Shebang,
    /** The file contains `#:` directives (package/sdk/property), strongly suggesting it is an entry point. */
    Directives,
}

/**
 * Reads the beginning of `filePath` to determine whether it looks like a file-based C#
 * app entry point.  This intentionally mirrors the heuristics used by the Roslyn
 * `FileBasedProgramsEntryPointDiscovery` class.
 *
 * An optional `readFileHead` function can be supplied (e.g. in tests) to replace the
 * default `fs`-based implementation.  It should return the raw file contents as a string,
 * or `null` if the file cannot be read.
 */
export function detectFileBasedAppKind(
    filePath: string,
    readFileHead: (p: string) => string | null = defaultReadFileHead
): FileBasedAppKind {
    const content = readFileHead(filePath);
    if (content === null) {
        return FileBasedAppKind.None;
    }

    // Strip an optional UTF-8 BOM before checking for `#!`.
    const stripped = content.startsWith('\uFEFF') ? content.slice(1) : content;

    if (stripped.startsWith('#!')) {
        return FileBasedAppKind.Shebang;
    }

    // Check the first few non-empty lines for `#:` directives.
    const lines = stripped.split(/\r?\n/);
    let checkedLines = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
            continue;
        }
        if (trimmed.startsWith('#:')) {
            return FileBasedAppKind.Directives;
        }
        // After encountering a line that is neither blank nor a directive, stop scanning.
        // Real entry points put their directives at the very top.
        if (++checkedLines >= 5) {
            break;
        }
    }

    return FileBasedAppKind.None;
}

/**
 * Default implementation of the `readFileHead` parameter for `detectFileBasedAppKind`.
 * Reads the first 4 KB of the file — sufficient to find `#!` / `#:` near the top
 * without loading potentially large source files.
 */
function defaultReadFileHead(filePath: string): string | null {
    try {
        const buffer = Buffer.alloc(4096);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);
        return buffer.subarray(0, bytesRead).toString('utf8');
    } catch {
        // Ignore unreadable files.
        return null;
    }
}
